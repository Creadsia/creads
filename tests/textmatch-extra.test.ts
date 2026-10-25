import { test } from "node:test";
import assert from "node:assert/strict";
import { compare, type Word } from "../src/lib/textmatch";

const said = (t: string): Word[] => t.split(/\s+/).map((w, i) => ({ w, s: i * 0.4, e: i * 0.4 + 0.35 }));
const SCRIPT = "Two gummies before bed, no melatonin, and I actually sleep through the night now. If you're tired of staring at the ceiling, tap the link.";

test("an inserted phrase (E2E 25 Oct: «Creads punto IA») is a severe error, redone for free", () => {
  const r = compare(SCRIPT, said("Two gummies before bed, no melatonin, and I actually sleep through the night now. Creeds Punto Iao. If you're tired of staring at the ceiling, tap the link."), "en", 12);
  assert.equal(r.severe, true);
  assert.ok(r.issues.some((x) => /frase que no está en el guion|Creads/.test(x)));
});

test("the exact script is not flagged", () => {
  const r = compare(SCRIPT, said(SCRIPT), "en", 12);
  assert.equal(r.severe, false);
});

test("naming Creads is fine when the script says it", () => {
  const s = "Hice este anuncio con Creads en cinco minutos y quedó increíble.";
  const r = compare(s, said(s), "es", 8);
  assert.equal(r.severe, false);
});
