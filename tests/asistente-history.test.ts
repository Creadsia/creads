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
  assert.equal(r[r.length - 1].content, "que paso?");
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
