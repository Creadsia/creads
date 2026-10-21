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
