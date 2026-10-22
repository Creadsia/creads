import { test } from "node:test";
import assert from "node:assert/strict";
import { repair, type Msg } from "../src/lib/asistente-history";

test("repair: a tool call without its answer (a cut reply) is dropped, so the next message works", () => {
  const broken: Msg[] = [
    { role: "user", content: "dame todos en formato historia" },
    { role: "assistant", content: [{ type: "text", text: "Voy." }, { type: "tool_use", id: "a", name: "creads_crear_imagen", input: {} }, { type: "tool_use", id: "b", name: "creads_crear_imagen", input: {} }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "a", content: "ok" }] },
    { role: "assistant", content: [{ type: "tool_use", id: "c", name: "creads_crear_imagen", input: {} }] },
    { role: "user", content: "que paso?" },
  ];
  const r = repair(broken);
  const uses = r.flatMap((m) => (Array.isArray(m.content) ? m.content.filter((x) => x.type === "tool_use").map((x) => x.id) : []));
  assert.deepEqual(uses, ["a"]);
  assert.ok(JSON.stringify(r[r.length - 1].content).includes("que paso?"));
  assert.ok(!r.some((m) => Array.isArray(m.content) && !m.content.length));
});

test("repair: an answer without its call is dropped; empty text blocks go away", () => {
  const r = repair([
    { role: "user", content: [{ type: "tool_result", tool_use_id: "x", content: "huérfano" }] },
    { role: "assistant", content: [{ type: "text", text: "  " }, { type: "text", text: "Hola" }] },
    { role: "user", content: "sí" },
  ]);
  assert.equal(r.length, 2);
  assert.deepEqual(r[0].content, [{ type: "text", text: "Hola" }]);
});

test("repair: two assistant messages in a row (a note after the calls) keep the calls paired", async () => {
  const { repair } = await import("../src/lib/asistente-history");
  const r = repair([
    { role: "user", content: "haz 3" },
    { role: "assistant", content: [{ type: "tool_use", id: "a", name: "x", input: {} }, { type: "tool_use", id: "b", name: "x", input: {} }] },
    { role: "assistant", content: [{ type: "text", text: "Voy avanzando" }] },
    { role: "user", content: [{ type: "text", text: "ok" }, { type: "tool_result", tool_use_id: "a", content: "1" }, { type: "tool_result", tool_use_id: "b", content: "2" }] },
    { role: "user", content: "continúa" },
  ]);
  for (let i = 0; i < r.length; i++) {
    const m = r[i];
    if (i) assert.notEqual(m.role, r[i - 1].role);
    const ids = Array.isArray(m.content) ? m.content.filter((x) => x.type === "tool_use").map((x) => x.id) : [];
    if (ids.length) {
      const next = r[i + 1];
      assert.ok(next && Array.isArray(next.content));
      const res = (next.content as { type: string; tool_use_id?: string }[]);
      assert.deepEqual(res.slice(0, ids.length).map((x) => x.tool_use_id), ids);
    }
  }
});

test("flatten: no tool blocks left, starts with the customer, sides alternate", async () => {
  const { flatten } = await import("../src/lib/asistente-history");
  const f = flatten([
    { role: "assistant", content: "hola" },
    { role: "user", content: "haz 1" },
    { role: "assistant", content: [{ type: "tool_use", id: "a", name: "creads_crear_anuncio", input: { guion: "x" } }] },
    { role: "user", content: [{ type: "tool_result", tool_use_id: "a", content: "ad_123" }] },
    { role: "user", content: "y?" },
  ]);
  assert.equal(f[0].role, "user");
  assert.ok(f.every((m) => Array.isArray(m.content) && m.content.every((x) => x.type === "text")));
  assert.ok(JSON.stringify(f).includes("ad_123"));
  for (let i = 1; i < f.length; i++) assert.notEqual(f[i].role, f[i - 1].role);
});
