import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILTIN_IDS, DEFAULT_STATE, agentsOf, budgetLeft, cleanAgent, newAgentId, scrubPersonal } from "../src/lib/oficina";
import { costOf, readResp } from "../src/lib/providers/grok";

test("customer text leaves without emails, phones or links", () => {
  const s = scrubPersonal("soy juan@gmail.com, mi fono +56 9 1234 5678, mira https://x.com/a?t=1");
  assert.ok(!/juan@|1234|https/.test(s), s);
  assert.match(s, /\[correo\].*\[número\].*\[enlace\]/);
});

test("built-in agents' shares add up to the whole budget", () => {
  const total = agentsOf(DEFAULT_STATE()).reduce((a, x) => a + x.sharePct, 0);
  assert.equal(total, 100);
  assert.deepEqual(BUILTIN_IDS, ["ceo", "produccion", "seguridad", "novedades", "soporte"]);
});

test("budget left per agent and in total", () => {
  const st = DEFAULT_STATE();
  st.budgetUsd = 30; st.spend.usd = 10; st.spend.byAgent.novedades = 10;
  const b = budgetLeft(st, { id: "novedades", sharePct: 35 });
  assert.equal(b.total, 20);
  assert.equal(+b.agent.toFixed(2), 0.5); // 35% of 30 = 10.5
});

test("owner's agents: checked, named, edited instructions win", () => {
  assert.equal(typeof cleanAgent({ name: "M", mission: "x" }), "string");
  assert.equal(typeof cleanAgent({ name: "Marketing", mission: "Eres el encargado de marketing de Creads.", sharePct: 90 }), "string");
  const a = cleanAgent({ name: " Marketing ", mission: "Eres el encargado de marketing de Creads.", sharePct: 10, sources: ["visitas", "hack" as never], search: true });
  assert.ok(typeof a !== "string");
  assert.deepEqual(a.sources, ["visitas"]);
  const st = DEFAULT_STATE();
  st.custom["a-marketing"] = a;
  assert.equal(newAgentId(st, "Márketing!"), "a-marketing-2");
  st.missions.ceo = "Instrucciones nuevas del dueño para el CEO.";
  assert.equal(agentsOf(st).find((x) => x.id === "ceo")!.mission, "Instrucciones nuevas del dueño para el CEO.");
  assert.equal(agentsOf(st).length, 6);
});

test("cost: the API's own figure wins, otherwise tokens, reasoning and searches", () => {
  assert.equal(costOf("grok-4.3", { usage: { cost_in_usd_ticks: 1e8 } }), 0.01);
  const c = costOf("grok-4.3", { usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 }, output: [{ type: "web_search_call" }, { type: "message" }] });
  assert.equal(+c.toFixed(3), +(1.25 + 2.5 + 0.005).toFixed(3));
  const x = costOf("grok-4.3", { usage: { output_tokens: 0, output_tokens_details: { reasoning_tokens: 1_000_000 }, num_sources_used: 10 } });
  assert.equal(+x.toFixed(3), 2.55);
});

test("answer text and citations are read from the Responses format", () => {
  const r = readResp({ output: [{ type: "web_search_call" }, { type: "message", content: [{ type: "output_text", text: "hola", annotations: [{ type: "url_citation", url: "https://a.com/x" }, { url: "javascript:alert(1)" }] }] }], citations: ["https://b.com"] });
  assert.equal(r.text, "hola");
  assert.deepEqual(r.sources.sort(), ["https://a.com/x", "https://b.com"]);
});

test("chat files only for safe agent ids", async () => {
  const { SAFE_ID } = await import("../src/lib/oficina");
  for (const ok of ["ceo", "novedades", "a-marketing", "a-marketing-2"]) assert.ok(SAFE_ID.test(ok), ok);
  for (const bad of ["x/../../finanzas", "a-../x", "A-x", "", "a-"]) assert.ok(!SAFE_ID.test(bad), bad);
});
