import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SUPABASE_URL = "https://sb.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
process.env.FAL_KEY = "test";

import { apiKeyFromRequest } from "../src/lib/auth";
import { API_FORMATS, readOrder, advanceAd, publicAd, type ApiAd } from "../src/lib/api-ads";

test("API keys come only as «Bearer creads_sk_…»", () => {
  const k = "creads_sk_" + "a".repeat(43);
  assert.equal(apiKeyFromRequest(new Request("https://x", { headers: { authorization: `Bearer ${k}` } })), k);
  assert.equal(apiKeyFromRequest(new Request("https://x", { headers: { authorization: "Bearer something-else-entirely-long-enough" } })), "");
  assert.equal(apiKeyFromRequest(new Request("https://x")), "");
});

test("an order is checked before anything is made", () => {
  assert.match(String(readOrder({})), /guion/);
  assert.match(String(readOrder({ guion: "x".repeat(30), formato: "faceless" })), /Formato no disponible/);
  assert.ok(!API_FORMATS.includes("faceless" as never));
  const o = readOrder({ guion: "Mi perro tiene nueve años y la urgencia me costó caro.", idioma: "en" });
  assert.equal(typeof o, "object");
  assert.equal((o as { formato: string }).formato, "ugc");
  assert.equal((o as { idioma: string }).idioma, "en");
  assert.match((o as { titulo: string }).titulo, /^Mi perro/);
  assert.match(String(readOrder({ guion: "x".repeat(30), modelo: "no-existe" })), /Modelo no disponible/);
});

test("each poll moves the ad one step, and two polls at once can't both run a step", async () => {
  let rpcCalls = 0;
  const allowed = new Set<string>();
  const writes: ApiAd[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/rest/v1/rpc/hit_rate")) {
      rpcCalls++;
      const key = JSON.parse(String(init?.body)).p_key as string;
      const ok = !allowed.has(key);
      allowed.add(key);
      return new Response(JSON.stringify(ok));
    }
    if (url.includes("/storage/v1/bucket")) return new Response("{}");
    if (url.includes("/storage/v1/object/")) { if (init?.method === "POST" || init?.method === "PUT") writes.push(JSON.parse(String(init.body))); return new Response("{}"); }
    return new Response("not mocked " + url, { status: 500 });
  }) as typeof fetch;
  const calls: string[] = [];
  const studio = (async (path: string) => { calls.push(path); return { titulo: "T", cortes: [{ tipo: "a", texto: "uno" }, { tipo: "b", texto: "dos" }] }; }) as never;
  const job: ApiAd = { id: "ad_test123", ws: "w01", userId: "u", createdAt: "2026-10-19T00:00:00Z", updatedAt: "2026-10-19T00:00:00Z", estado: "cola", titulo: "x", formato: "ugc", idioma: "es-CL", guion: "g".repeat(30), sello: false };
  const [a, b] = await Promise.all([advanceAd(job, studio), advanceAd(job, studio)]);
  assert.equal(calls.length, 1, "only one runner did the step");
  assert.ok([a.estado, b.estado].includes("escenas"));
  assert.ok(rpcCalls >= 2);
  const moved = writes.at(-1)!;
  assert.equal(moved.estado, "escenas");
  assert.ok(moved.checkedAt);
  const v = publicAd({ ...moved, estado: "listo", videoUrl: "/api/media/ws/w01/x.mp4" });
  assert.match(String(v.video_url), /^https?:\/\/.+\/api\/media\/ws\/w01\/x\.mp4$/);
});

test("an order can name an avatar of the account (same face in every cut)", () => {
  const ok = readOrder({ guion: "Mi perro tiene nueve años y la urgencia me costó caro.", avatar: "11111111-1111-1111-1111-111111111111" });
  assert.equal((ok as { avatarId: string }).avatarId, "11111111-1111-1111-1111-111111111111");
  assert.match(String(readOrder({ guion: "Mi perro tiene nueve años y la urgencia me costó caro.", avatar: "../otro" })), /avatar no es válido/);
});

test("readOrder: «persona-real» is accepted with an avatar (Automático used to be told it wasn't available)", () => {
  const prev = process.env.FAL_KEY;
  process.env.FAL_KEY = "test";
  try {
    const av = "0f60b13b-3e26-4d26-8148-82cf7709e0b9";
    const ok = readOrder({ guion: "x".repeat(30), modelo: "persona-real", avatar: av });
    assert.equal(typeof ok, "object");
    assert.equal((ok as { modelo?: string }).modelo, "persona-real");
    assert.match(String(readOrder({ guion: "x".repeat(30), modelo: "persona-real" })), /avatar/);
  } finally { if (prev === undefined) delete process.env.FAL_KEY; else process.env.FAL_KEY = prev; }
});

test("readOrder: dramatization label by language and voice speed capped at 1.2", () => {
  const g = "I got three quotes, fixed my foundation and the cracks are gone.";
  const en = readOrder({ guion: g, idioma: "en", dramatizacion: true, velocidad: 1.5 });
  assert.ok(typeof en !== "string");
  assert.equal(en.aviso, "Dramatization · AI actor");
  assert.equal(en.velocidad, 1.2);
  const es = readOrder({ guion: g, dramatizacion: true, velocidad: 1 });
  assert.ok(typeof es !== "string");
  assert.equal(es.aviso, "Dramatización · actor IA");
  assert.equal(es.velocidad, undefined);
  const none = readOrder({ guion: g });
  assert.ok(typeof none !== "string" && !none.aviso);
});

test("avisoAss: one label for the whole ad, top right", async () => {
  const { avisoAss } = await import("../src/lib/montage");
  const a = avisoAss("Dramatización · actor IA", 720, 1280, 20);
  assert.match(a, /Dialogue: 0,0:00:00\.00,0:00:21\.00,Aviso,,0,0,0,,Dramatización · actor IA/);
  assert.match(a, /Style: Aviso,[^\n]*,9,/);
});

test("readOrder: several places only when asked", () => {
  const g = "Si tu fundación se ve así, no firmes nada todavía, mira esto.";
  const o = readOrder({ guion: g, lugares: "  afuera de la casa;  el sótano; la cocina " });
  assert.ok(typeof o !== "string");
  assert.equal(o.lugares, "afuera de la casa; el sótano; la cocina");
  const one = readOrder({ guion: g });
  assert.ok(typeof one !== "string" && !one.lugares);
});
