// Credits: charged atomically, never below zero, refunded once, invisible to customers.
// Run: npx tsx --test tests/billing.test.ts
import assert from "node:assert/strict";
import { before, describe, test } from "node:test";
import { testDatabase } from "./pg-harness";

type PG = Awaited<ReturnType<typeof testDatabase>>;
let pg: PG;
const q = async (sql: string, p: unknown[] = []) => (await pg.query(sql, p)).rows as Record<string, unknown>[];
const balance = async (ws: string) => Number((await q("select public.credit_balance($1) as b", [ws]))[0].b);
const spend = async (ws: string, n: number, ref: string, free = false) =>
  (await q("select * from public.spend_credits($1, $2, 'test', $3, 0.1, 'u', $4)", [ws, n, ref, free]))[0] as { ok: boolean; balance: number; charge_id: number | null };

before(async () => {
  pg = await testDatabase();
  await pg.exec("insert into public.workspaces (id, name) values ('cliente-a', 'A'), ('cliente-b', 'B')");
  await pg.exec("insert into public.credits (owner, delta, kind, note) values ('cliente-a', 100, 'plan', 'Starter')");
});

describe("credits", () => {
  test("a job is charged only when the balance covers it", async () => {
    const r = await spend("cliente-a", 60, "clip-1");
    assert.equal(r.ok, true);
    assert.equal(r.balance, 40);
    const no = await spend("cliente-a", 50, "clip-2");
    assert.equal(no.ok, false);
    assert.equal(await balance("cliente-a"), 40);
    assert.equal((await spend("cliente-b", 1, "x")).ok, false); // B has nothing
  });

  test("a failed job is refunded once, the latest charge first", async () => {
    await spend("cliente-a", 10, "clip-3");
    await spend("cliente-a", 10, "clip-3"); // a retry of the same clip
    assert.equal(await balance("cliente-a"), 20);
    const one = await q("select public.refund_last('cliente-a', 'clip-3', 'falló') as n");
    assert.equal(Number(one[0].n), 10);
    const two = await q("select public.refund_last('cliente-a', 'clip-3', 'falló') as n");
    assert.equal(Number(two[0].n), 10); // the earlier charge
    const three = await q("select public.refund_last('cliente-a', 'clip-3', 'falló') as n");
    assert.equal(Number(three[0].n), 0); // nothing left to refund
    assert.equal(await balance("cliente-a"), 40);
  });

  test("free redos are recorded without charging", async () => {
    const r = await spend("cliente-a", 30, "clip-1", true);
    assert.equal(r.ok, true);
    assert.equal(await balance("cliente-a"), 40);
  });

  test("negative amounts are refused", async () => {
    await assert.rejects(spend("cliente-a", -500, "hack"));
  });

  test("customers' database role can't see or touch credits", async () => {
    const asApp = (sql: string) => pg.transaction(async (tx) => {
      await tx.query("set local role creads_app");
      await tx.query("select set_config('app.workspace', 'cliente-a', true)");
      return tx.query(sql);
    });
    await assert.rejects(asApp("select * from public.credits"));
    await assert.rejects(asApp("insert into public.credits (owner, delta, kind) values ('cliente-a', 99999, 'topup')"));
    await assert.rejects(asApp("select public.spend_credits('cliente-b', 0, 'x', 'y', 0, 'z', true)"));
    await assert.rejects(asApp("select public.refund_last('cliente-a', 'clip-1', 'x')"));
  });
});

describe("free redos", () => {
  const AD = "11111111-1111-1111-1111-111111111111";
  const grantV = async (clip: string) => (await q("select public.grant_free_redo('cliente-a', $1, $2) as ok", [AD, clip]))[0].ok;
  const useV = async (clip: string) => (await q("select public.use_free_redo('cliente-a', $1, $2) as id", [AD, clip]))[0].id;

  test("only what the review granted, once per clip, two per ad", async () => {
    assert.equal(await useV("c1"), null); // nothing granted yet
    assert.equal(await grantV("c1"), true);
    assert.equal(await grantV("c1"), true); // same clip: no second voucher
    assert.equal(await grantV("c2"), true);
    assert.equal(await grantV("c3"), false); // third clip of the same ad
    const before = await balance("cliente-a");
    assert.ok(await useV("c1"));
    assert.equal(await useV("c1"), null); // already used
    assert.equal(await balance("cliente-a"), before); // free means free
  });

  test("a failed free redo gives the voucher back, and doesn't touch paid charges", async () => {
    await spend("cliente-a", 7, "c2"); // an earlier paid run of c2
    const bal = await balance("cliente-a");
    assert.ok(await useV("c2"));
    await q("select public.refund_last('cliente-a', 'c2', 'falló')"); // the free redo failed
    assert.equal(await balance("cliente-a"), bal); // the paid run was not refunded
    assert.ok(await useV("c2")); // the voucher works again
  });
});

describe("rate limits", () => {
  test("allows up to the limit, then refuses", async () => {
    const hit = async () => (await q("select public.hit_rate('login:test', 600, 3) as ok"))[0].ok;
    assert.equal(await hit(), true);
    assert.equal(await hit(), true);
    assert.equal(await hit(), true);
    assert.equal(await hit(), false);
  });
});
