import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanPlan, cutTimes, proAss, proPrompt, END_SECS } from "../src/lib/pro-edit";

test("Edición Pro: the plan is cleaned (inside the video, no overlaps, short texts) and drawn as ASS", () => {
  const plan = cleanPlan({
    golpes: [
      { texto: "¿Tu ganador *se quemó?*", desde: 0.1, hasta: 1.8 },
      { texto: "Se pisa con el anterior", desde: 1.0, hasta: 2.0 },
      { texto: "una frase demasiado larga para un golpe", desde: 3, hasta: 4 },
      { texto: "Testea *como loco*", desde: 9.5, hasta: 40 },
    ],
    cierre: { titulo: "creadsia.com", linea: "" },
  }, 10, { titulo: "¡Pruébalo hoy!", linea: "Entra ya" });
  assert.equal(plan.golpes.length, 3, "a too-long headline is dropped");
  assert.equal(plan.golpes[0].hasta, 0.9, "an overlapping one shortens the one before");
  assert.ok(plan.golpes[2].hasta <= 10, "never past the end of the video");
  assert.equal(plan.cierre.titulo, "creadsia.com");
  assert.equal(plan.cierre.linea, "Entra ya", "missing line falls back");
  const ass = proAss(plan, 720, 1280, 10);
  assert.match(ass, /PlayResX: 720/);
  assert.match(ass, /¿TU GANADOR \{\\c&HD62BFF&\}SE QUEMÓ\?\{\\c&HFFFFFF&\}/, "key word in the brand pink");
  assert.match(ass, new RegExp(`0:00:${(10 + END_SECS).toFixed(2)}`), "closing card lasts END_SECS");
  assert.doesNotMatch(ass, /\*/, "no asterisks left on screen");
  assert.deepEqual(cutTimes([4, 3.5, 2.5]), [4, 7.5]);
  assert.match(proPrompt("Hola mundo", [{ w: "Hola", s: 0.1, e: 0.4 }], "es", { titulo: "Mi tienda" }), /Use exactly this title: "Mi tienda"/);
});

test("Edición Pro: garbage from the AI still gives a usable plan", () => {
  const plan = cleanPlan("nope", 12, { titulo: "¡Pruébalo hoy!", linea: "" });
  assert.equal(plan.golpes.length, 0);
  assert.equal(plan.cierre.titulo, "¡Pruébalo hoy!");
  assert.ok(proAss(plan, 720, 1280, 12).includes("¡Pruébalo hoy!"));
});

test("the editor brief and style reach the prompt", () => {
  const p = proPrompt("Pide tu café hoy", [{ w: "Pide", s: 0, e: 0.3 }], "es", { notas: "Marca: Café Lumbre. Evitar: precios.", estilo: "elegante" });
  assert.match(p, /Café Lumbre/);
  assert.match(p, /calm and premium/);
  assert.match(proPrompt("x", [], "es"), /energetic/);
});

test("a web address heard as one word keeps its spelling in the captions", async () => {
  const { respell } = await import("../src/lib/montage");
  const w = (x: string, s: number) => ({ w: x, s, e: s + 0.2 });
  const out = respell([w("Entra", 0), w("a", 0.3), w("creadsia.com.", 0.5)], "Entra a Creads IA punto com.");
  assert.deepEqual(out.map((x) => x.w), ["Entra", "a", "creadsia.com."]);
  const out2 = respell([w("Entra", 0), w("a", 0.3), w("creadsiacom", 0.5)], "Entra a Creads IA punto com.");
  assert.deepEqual(out2.map((x) => x.w), ["Entra", "a", "Creads IA punto com."]);
});
