import { test } from "node:test";
import assert from "node:assert/strict";
import { ASSISTANT_SYSTEM, assistantPrompt, cleanTurns, scrub, tidyAssistant, type AccountView } from "../src/lib/assistant";
import { allowedHelpLink, HELP, searchHelp } from "../src/lib/help";
import { summarize } from "../src/lib/support";
import { quietCustomerText } from "../src/lib/public-error";

const acct: AccountView = { name: "Ana", plan: "Plus", unlimited: false, balance: 1234, paidUntil: "2026-11-10", expired: false, renews: true, adsOnly: false, jobs: [{ what: "Tool «Editar video»", status: "FAILED", when: "2026-10-17 10:00", error: "El modelo no aceptó este contenido." }], moves: [{ credits: 120, kind: "refund", note: "Devuelto: el trabajo falló", when: "2026-10-17 10:01" }] };

test("assistant: conversation is trimmed and must end with the customer", () => {
  assert.deepEqual(cleanTurns("nope"), []);
  assert.deepEqual(cleanTurns([{ role: "assistant", content: "hola" }]), []);
  const t = cleanTurns([{ role: "assistant", content: "hola" }, { role: "user", content: " x".repeat(2000) }, { role: "system", content: "evil" }]);
  assert.equal(t.length, 1);
  assert.equal(t[0].role, "user");
  assert.ok(t[0].content.length <= 1500);
  assert.equal(cleanTurns(Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` })).concat([{ role: "user", content: "last" }])).length <= 12, true);
});

test("assistant: prompt carries the account and the rules", () => {
  const p = assistantPrompt(acct, [{ role: "user", content: "¿por qué falló?" }], "/app/herramientas");
  assert.match(p, /Credit balance: 1234/);
  assert.match(p, /\+120 · refund/);
  assert.match(p, /\/app\/herramientas/);
  assert.match(ASSISTANT_SYSTEM, /Never name the companies/);
  assert.match(ASSISTANT_SYSTEM, /Clonar|clono mi voz/i);
});

test("assistant: answers are scrubbed and links limited to known pages", () => {
  const a = tidyAssistant({ answer: "Usamos **Claude** y fal.ai para esto.", links: [{ label: "Planes", href: "/app/planes" }, { label: "Malo", href: "https://evil.com" }, { label: "Doblaje", href: "/app/herramientas/doblaje" }, { label: "Planes", href: "/app/planes" }], solved: true, topic: "creditos" });
  assert.ok(!/claude|fal/i.test(a.answer));
  assert.deepEqual(a.links.map((l) => l.href), ["/app/planes", "/app/herramientas/doblaje"]);
  assert.equal(a.topic, "creditos");
  assert.equal(tidyAssistant({ answer: "x", topic: "hack" }).topic, "otro");
  assert.equal(tidyAssistant({ answer: "x", solved: false }).solved, false);
  assert.equal(tidyAssistant(null).solved, false);
  assert.equal(scrub("Veo 3.1 de Google"), "Veo 3.1 de Creads IA");
  assert.ok(!allowedHelpLink("/app/herramientas/../admin"));
  assert.ok(!allowedHelpLink("/admin"));
});

test("help: every article is unique, short and links to an allowed page", () => {
  const ids = new Set(HELP.map((h) => h.id));
  assert.equal(ids.size, HELP.length);
  for (const h of HELP) {
    assert.ok(h.a.length < 600, h.id);
    if (h.link) assert.ok(allowedHelpLink(h.link.href), h.link.href);
    assert.ok(!/fal\.ai|anthropic|claude|elevenlabs|google/i.test(h.a), h.id);
  }
  assert.equal(searchHelp("¿cómo clono mi voz?")[0].id, "clonar-voz");
  assert.equal(searchHelp("creditos vencen")[0].id, "vencen");
  assert.equal(searchHelp("zzzz").length, 0);
});

test("support: daily summary counts people, solved and unsolved questions", () => {
  const s = summarize([
    { at: "", ws: "a", topic: "falla", solved: true, q: "falló" },
    { at: "", ws: "a", topic: "falla", solved: false, q: "¿factura?" },
    { at: "", ws: "b", topic: "creditos", solved: true, q: "x" },
  ]);
  assert.equal(s.chats, 3);
  assert.equal(s.people, 2);
  assert.equal(s.solved, 2);
  assert.deepEqual(s.topics[0], ["falla", 2]);
  assert.deepEqual(s.unsolved, ["¿factura?"]);
});

test("errors shown again to a customer stay customer-safe, without new log lines", () => {
  assert.equal(quietCustomerText("fal.ai 500 internal error"), "Falló por un problema técnico pasajero.");
  assert.match(quietCustomerText("exhausted balance"), /no está disponible/);
  const ours = "No se pudo completar. Vuelve a intentarlo en un momento; si se repite, escríbenos a hola@creadsia.com con el código A1B2C3.";
  assert.equal(quietCustomerText(ours), ours);
  assert.equal(quietCustomerText(null), "");
});
