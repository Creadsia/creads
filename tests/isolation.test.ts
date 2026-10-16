// Customers must never see, change or delete each other's data.
// Runs Creads' real schema + tenancy rules in an in-memory Postgres and tries every way to "spy".
// Run: npx tsx --test tests/isolation.test.ts
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { dbFor, setExecutor, sharedRules } from "../src/lib/db";
import { testDatabase } from "./pg-harness";

type PG = Awaited<ReturnType<typeof testDatabase>>;
let pg: PG;

/** Runs SQL exactly like production: as the app role, inside a transaction that names the workspace. */
async function asApp(ws: string | null, sql: string, params: unknown[] = []) {
  return pg.transaction(async (tx) => {
    await tx.query("set local role creads_app");
    await tx.query("select set_config('app.workspace', $1, true)", [ws ?? ""]);
    return (await tx.query(sql, params)).rows as Record<string, unknown>[];
  });
}

before(async () => {
  pg = await testDatabase();
  await pg.exec("insert into public.workspaces (id, name) values ('cliente-a', 'A'), ('cliente-b', 'B')");
  setExecutor(asApp);
});
after(() => setExecutor(null));

describe("the database keeps customers apart", () => {
  const A = () => dbFor("cliente-a");
  const B = () => dbFor("cliente-b");

  test("a customer only lists its own rows", async () => {
    await A().insert("avatars", { name: "Avatar de A" });
    await B().insert("avatars", { name: "Avatar de B" });
    const a = await A().list("avatars");
    const b = await B().list("avatars");
    assert.deepEqual(a.map((r) => r.name), ["Avatar de A"]);
    assert.deepEqual(b.map((r) => r.name), ["Avatar de B"]);
    assert.equal(a[0].owner, "cliente-a");
  });

  test("B can't read, edit or delete A's row by id", async () => {
    const row = await A().insert("products", { name: "Producto de A" });
    const id = String(row.id);
    assert.equal(await B().get("products", id), null);
    assert.equal(await B().update("products", id, { name: "hackeado" }), undefined);
    await B().remove("products", id);
    const still = await A().get("products", id);
    assert.equal(still?.name, "Producto de A");
  });

  test("B can't plant a row in A's workspace", async () => {
    // the app strips `owner` from what clients send...
    const row = await B().insert("scripts", { title: "x", text: "hola", owner: "cliente-a" } as Record<string, unknown>);
    assert.equal(row.owner, "cliente-b");
    // ...and even raw SQL as B is refused by the database
    await assert.rejects(asApp("cliente-b", "insert into public.scripts (title, text, owner) values ('x', 'hola', 'cliente-a')"));
    await assert.rejects(asApp("cliente-b", "update public.scripts set owner = 'cliente-a' where owner = 'cliente-b'"));
  });

  test("B can't attach a clip to A's ad, or an ad to A's script", async () => {
    const script = await A().insert("scripts", { title: "guion A", text: "hola" });
    const ad = await A().insert("ads", { title: "anuncio A" });
    await assert.rejects(B().insert("clips", { ad_id: ad.id, idx: 0 }));
    await assert.rejects(B().insert("ads", { title: "y", script_id: script.id }));
  });

  test("filters can't widen the view", async () => {
    // a filter on owner still only matches inside the caller's workspace
    const rows = await B().list("avatars", "owner=eq.cliente-a");
    assert.equal(rows.length, 0);
    // values travel as parameters: SQL inside a value is just text
    assert.equal((await B().list("avatars", "name=eq.x';drop table avatars;--")).length, 0);
    assert.equal((await B().list("avatars")).length, 1);
    // unknown columns are refused before reaching the database
    await assert.rejects(B().list("avatars", "order=owner;delete from avatars.desc"), /Columna/);
    await assert.rejects(B().list("avatars", "password_hash=eq.x"), /Filtro/);
  });

  test("without a workspace nothing is visible", async () => {
    const rows = await asApp(null, "select * from public.avatars");
    assert.equal(rows.length, 0);
    await assert.rejects(asApp(null, "insert into public.avatars (name) values ('x')"));
  });

  test("other customers' workspaces and accounts are out of reach", async () => {
    const ws = await asApp("cliente-b", "select id from public.workspaces");
    assert.deepEqual(ws.map((r) => r.id), ["cliente-b"]);
    await assert.rejects(asApp("cliente-b", "select * from public.users"));
    await assert.rejects(asApp("cliente-b", "select * from public.sessions"));
  });

  test("the app role can't switch off the rules", async () => {
    await assert.rejects(asApp("cliente-b", "alter table public.avatars disable row level security"));
    // it is not a superuser, can't skip RLS and belongs to no other role it could switch to
    const r = (await pg.query("select rolsuper, rolbypassrls from pg_roles where rolname = 'creads_app'")).rows[0] as { rolsuper: boolean; rolbypassrls: boolean };
    assert.equal(r.rolsuper, false);
    assert.equal(r.rolbypassrls, false);
    const m = await pg.query("select 1 from pg_auth_members am join pg_roles r on r.oid = am.member where r.rolname = 'creads_app'");
    assert.equal(m.rows.length, 0);
  });

  test("bad workspace names are refused", () => {
    assert.throws(() => dbFor("x' or '1'='1"));
    assert.throws(() => dbFor(""));
  });

  test("learned rules are shared, and always belong to Creadsia", async () => {
    await sharedRules.add({ rule_en: "Keep the same shirt in every cut", hits: 1, active: true });
    const forA = await asApp("cliente-a", "select rule_en, owner from public.rules");
    const forB = await asApp("cliente-b", "select rule_en, owner from public.rules");
    assert.equal(forA.length, 1);
    assert.equal(forB.length, 1);
    assert.equal(forA[0].owner, "main");
    await assert.rejects(asApp("cliente-b", "delete from public.rules"));
  });
});

describe("the fallback way in (REST) always filters by workspace", () => {
  test("every call carries the caller's workspace", async () => {
    setExecutor(null);
    const prev = { url: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, db: process.env.DATABASE_URL };
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "sb_secret_test";
    delete process.env.DATABASE_URL;
    const seen: { url: string; body?: string }[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      seen.push({ url: String(input), body: init?.body ? String(init.body) : undefined });
      return new Response("[]", { status: 200, headers: { "content-range": "0-0/0" } });
    }) as typeof fetch;
    try {
      const B = dbFor("cliente-b");
      const id = "00000000-0000-0000-0000-000000000001";
      await B.list("avatars");
      await B.list("clips", "ad_id=eq.x&order=idx.asc");
      await B.get("ads", id);
      await B.update("ads", id, { title: "t" });
      await B.remove("ads", id);
      await B.count("images");
      await B.insert("avatars", { name: "n", owner: "cliente-a" } as Record<string, unknown>);
      for (const s of seen.slice(0, 6)) assert.match(s.url, /[?&]owner=eq\.cliente-b(&|$)/, s.url);
      assert.equal(JSON.parse(seen[6].body!).owner, "cliente-b");
    } finally {
      globalThis.fetch = realFetch;
      process.env.SUPABASE_URL = prev.url;
      process.env.SUPABASE_SERVICE_ROLE_KEY = prev.key;
      if (prev.db) process.env.DATABASE_URL = prev.db;
    }
  });
});
