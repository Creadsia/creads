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

describe("online payments", () => {
  test("a payment is applied once: credits, plan date and order, all together", async () => {
    await pg.query("insert into public.orders (id, owner, email, item, period, method, quote) values ('CR-AAAA0001', 'cliente-b', 'b@b.cl', 'starter', 'mensual', 'mercadopago', '{}')");
    const apply = async () => (await q("select public.apply_payment('mp:999', 'CR-AAAA0001', 27990, 'CLP', 1000, 1, 'Starter', 'Plan Starter') as r"))[0].r;
    const before = await balance("cliente-b");
    assert.equal(await apply(), "applied");
    assert.equal(await apply(), "already"); // repeated notification
    assert.equal(await balance("cliente-b"), before + 1000);
    const w = (await q("select plan, paid_until from public.workspaces where id = 'cliente-b'"))[0];
    assert.equal(w.plan, "Starter");
    assert.ok(w.paid_until);
    const o = (await q("select status, payments from public.orders where id = 'CR-AAAA0001'"))[0];
    assert.equal(o.status, "pagado");
    assert.deepEqual(o.payments, ["mp:999"]);
    // a renewal (another payment) adds another month
    assert.equal((await q("select public.apply_payment('mp:1000', 'CR-AAAA0001', 55990, 'CLP', 1000, 1, 'Starter', 'Renovación') as r"))[0].r, "applied");
    assert.equal(await balance("cliente-b"), before + 2000);
  });

  test("unknown order: nothing is applied", async () => {
    await assert.rejects(q("select public.apply_payment('mp:5', 'CR-NOPE', 1, 'CLP', 10, 0, null, 'x')"));
    assert.equal((await q("select count(*)::int as n from public.payments where id = 'mp:5'"))[0].n, 0);
  });

  test("customers' role can't see orders or apply payments", async () => {
    const asApp = (sql: string) => pg.transaction(async (tx) => {
      await tx.query("set local role creads_app");
      await tx.query("select set_config('app.workspace', 'cliente-b', true)");
      return tx.query(sql);
    });
    await assert.rejects(asApp("select * from public.orders"));
    await assert.rejects(asApp("select public.apply_payment('x:1', 'CR-AAAA0001', 1, 'CLP', 99999, 0, null, 'hack')"));
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

test("onSale: only the plans of 25 Oct 2026 (monthly or yearly), the packs and the Pack Prueba", async () => {
  const { onSale } = await import("../src/lib/catalog");
  assert.equal(onSale("studio", "mensual"), false);
  assert.equal(onSale("plus", "mensual"), false);
  assert.equal(onSale("starter", "mensual"), false);
  assert.equal(onSale("basico", "mensual"), false);
  assert.equal(onSale("testea", "mensual"), true);
  assert.equal(onSale("escala", "anual"), true);
  assert.equal(onSale("agencia", "mensual"), true);
  assert.equal(onSale("pack-500", "mensual"), true);
  assert.equal(onSale("pack-prueba", "mensual"), true);
});

test("quote: founder price, Pack Prueba discount and yearly «2 meses gratis» (round prices)", async () => {
  const { quote } = await import("../src/lib/catalog");
  const f = quote("escala", "mensual", { firstPurchase: true, fundador: true })!;
  assert.equal(f.total, 49);
  assert.equal(f.fundador, 10);
  const fp = quote("escala", "mensual", { firstPurchase: true, fundador: true, pack: { order: "CR-ABCDEF", usd: 9 } })!;
  assert.equal(fp.total, 40);
  assert.equal(fp.packOrder, "CR-ABCDEF");
  // the founder price is only for Escala, monthly
  assert.equal(quote("testea", "mensual", { fundador: true })!.total, 29);
  assert.equal(quote("escala", "anual", { fundador: true })!.fundador, undefined);
  const y = quote("testea", "anual")!;
  assert.equal(y.total, 290); // Testea yearly: US$290 (pay 10, use 12)
  assert.equal(quote("escala", "anual")!.total, 590);
  assert.equal(quote("agencia", "anual")!.total, 1490);
  assert.equal(y.credits, 470 * 12);
  const p = quote("pack-prueba", "mensual", { discountPct: 50 })!;
  assert.equal(p.total, 9);
  assert.equal(p.credits, 125);
});
