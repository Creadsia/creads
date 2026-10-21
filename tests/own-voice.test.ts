import { test } from "node:test";
import assert from "node:assert/strict";
import { takesOwnVoice } from "../src/lib/formats";
import { lipsyncProUsd, lipsyncSeconds, lipsyncUsd } from "../src/lib/historias";

test("own voice: only formats where one person talks to the camera", () => {
  assert.equal(takesOwnVoice("ugc"), true);
  assert.equal(takesOwnVoice("comentario"), true);
  assert.equal(takesOwnVoice("noticiero"), true);
  assert.equal(takesOwnVoice("podcast"), false);
  assert.equal(takesOwnVoice("entrevista"), false);
  assert.equal(takesOwnVoice("faceless"), false);
});

test("natural lip-sync costs more than the fast one and fits the line", () => {
  const line = "Por eso creamos Creads IA. Escribes tu idea y Creads arma el guion.";
  const secs = lipsyncSeconds(line);
  assert.ok(secs >= 4 && secs <= 10);
  assert.ok(lipsyncProUsd(secs, line) > lipsyncUsd(secs, line));
  assert.ok(lipsyncProUsd(8, line) < 0.7);
});

test("long cuts are split for the voice, keeping every word", async () => {
  const { splitLong } = await import("../src/app/app/crear/voz");
  const texto = "Tu anuncio ganador se quemó otra vez y ahora necesitas tres nuevos para mañana. Yo antes perdía un día entero grabando y editando cada video.";
  const out = splitLong([{ tipo: "Hook", texto, traduccion: "", mostrar: "" }]);
  assert.ok(out.length >= 2);
  assert.ok(out.every((c) => c.texto.split(/\s+/).length <= 14));
  assert.equal(out.map((c) => c.texto).join(" "), texto);
});

test("pronunciation: the voice reads the brand as written in the guide", async () => {
  const { sayable } = await import("../src/app/app/crear/voz");
  assert.equal(sayable("Por eso creamos Creads IA.", "Creads = Cri ads"), "Por eso creamos Cri ads IA.");
  assert.equal(sayable("Entra a creadsia.com hoy", "creadsia.com = creads ia punto com"), "Entra a creads ia punto com hoy");
  assert.equal(sayable("Sin cambios", ""), "Sin cambios");
});
