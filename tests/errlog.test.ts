import { test } from "node:test";
import assert from "node:assert/strict";
import { groupErrors, redact, signature } from "../src/lib/errlog";
import { spikes, summarizeGen } from "../src/lib/genstats";

test("error log: secrets, link signatures and emails are never stored", () => {
  const r = redact("fal error https://x.supabase.co/storage/v1/object/sign/a.mp4?token=abc.def key sk-ant-api03-AAAAAAAAAAAAAAAA from ana@empresa.cl id 0123456789abcdef0123456789abcdef0123");
  assert.ok(!r.includes("token=abc"));
  assert.ok(!r.includes("sk-ant"));
  assert.ok(!r.includes("ana@empresa.cl"));
  assert.ok(!/[0-9a-f]{32}/.test(r));
});

test("error log: same problem, same group, whatever the numbers", () => {
  assert.equal(signature("servidor", "Timeout after 30000 ms on job 123"), signature("servidor", "Timeout after 45000 ms on job 987"));
  assert.notEqual(signature("servidor", "a"), signature("navegador", "a"));
  const g = groupErrors([
    { at: "2026-10-17T10:00:00Z", area: "servidor", sig: "aaaaaaaaaaaa", message: "x", ref: "A1" },
    { at: "2026-10-17T11:00:00Z", area: "servidor", sig: "aaaaaaaaaaaa", message: "x2", ref: "B2" },
    { at: "2026-10-17T09:00:00Z", area: "navegador", sig: "bbbbbbbbbbbb", message: "y" },
  ], { bbbbbbbbbbbb: "2026-10-17T09:30:00Z", aaaaaaaaaaaa: "2026-10-17T10:30:00Z" });
  assert.equal(g[0].count, 2);
  assert.equal(g[0].message, "x2");
  assert.deepEqual(g[0].refs, ["A1", "B2"]);
  assert.equal(g[0].resolved, false); // happened again after being marked
  assert.equal(g[1].resolved, true);
});

test("generations: failure rates per model and alarms only when it matters", () => {
  const clips = [
    ...Array.from({ length: 8 }, () => ({ status: "done", kind: "gen:video", model: "veo-fast", usd: 0.8, ad_id: null })),
    ...Array.from({ length: 4 }, () => ({ status: "failed", kind: "tool:editar-video", model: "Kling O1 Edit", usd: 1, ad_id: null })),
    { status: "pending", kind: null, model: "veo-fast", usd: 1, ad_id: "x" },
  ];
  const s = summarizeGen(clips, 24, 300);
  assert.equal(s.total, 12);
  assert.equal(s.failed, 4);
  assert.equal(s.failedUsd, 4);
  assert.equal(s.rows[0].label, "Herramienta · Editar video");
  const sp = spikes(s);
  assert.ok(sp.some((x) => x.key === "fallas:todas")); // 33% of 12
  assert.equal(spikes(summarizeGen(clips.slice(0, 9), 24)).length, 0);
});

test("error log: bearer tokens and base64 keys are hidden, page paths are kept", () => {
  const r = redact("Authorization: Bearer abc.def-123 key=Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZmdo+/xyz== on /app/herramientas/copiar-movimiento");
  assert.ok(!r.includes("abc.def-123"));
  assert.ok(!r.includes("Zm9vYmFy"));
  assert.ok(r.includes("/app/herramientas/copiar-movimiento"));
});

test("error log: repeats counted on one entry add up in the group", () => {
  const g = groupErrors([
    { at: "2026-10-17T10:00:00Z", area: "navegador", sig: "cccccccccccc", message: "z", n: 7 },
    { at: "2026-10-17T10:05:00Z", area: "navegador", sig: "cccccccccccc", message: "z" },
  ]);
  assert.equal(g[0].count, 8);
});
