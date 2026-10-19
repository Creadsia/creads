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
