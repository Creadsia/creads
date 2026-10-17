import { test } from "node:test";
import assert from "node:assert/strict";
import { MODES, guionPrompt, tidyAnswer, scriptText } from "../src/lib/guiones";

test("every mode has a prompt asking for JSON, with the hard rules where scripts are written", () => {
  for (const m of MODES) {
    const p = guionPrompt({ mode: m.id, script: "Si tu casa tiene esta grieta, no la tapes. Llama hoy.", lang: "es-CL", niche: "Techos", context: "inspección gratis", idea: "vecino" });
    assert.match(p, /Responde SOLO JSON/);
    if (m.id !== "desarmar") assert.match(p, /NO inventes precios/);
  }
  assert.match(guionPrompt({ mode: "angulos", script: "x", lang: "en" }), /"es":/);
});

test("tidyAnswer keeps only well-formed parts", () => {
  const a = tidyAnswer("desarmar", { analysis: { titulo: "X", puntaje: 14, bloques: [{ tipo: "hook", texto: "Hola" }, { tipo: "??", texto: "" }], fortalezas: ["a", 3] } });
  assert.equal(a.analysis?.puntaje, 10);
  assert.equal(a.analysis?.bloques.length, 1);
  assert.equal(a.analysis?.bloques[0].tipo, "Hook");
  const h = tidyAnswer("hooks", { hooks: [{ texto: "b", nota: 5 }, { texto: "a", nota: 9 }, { nota: 10 }] });
  assert.deepEqual(h.hooks?.map((x) => x.texto), ["a", "b"]);
  const s = tidyAnswer("angulos", { scripts: [{ titulo: "A", bloques: [{ tipo: "Hook", texto: "uno" }, { tipo: "CTA", texto: "dos" }] }, { bloques: [] }] });
  assert.equal(s.scripts?.length, 1);
  assert.equal(scriptText(s.scripts![0].bloques), "uno\ndos");
  assert.deepEqual(tidyAnswer("mejorar", { nada: 1 }).scripts, []);
});
