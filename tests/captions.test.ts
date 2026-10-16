// Subtitles: spelled as in the script, every option reaches the .ass file, old settings still work.
// Run: npx tsx --test tests/captions.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_STYLE, fontPx, normalizeStyle, shapeWord } from "../src/lib/caption-style";
import { captions, respell } from "../src/lib/montage";

const timed = (t: string) => t.split(" ").map((w, i) => ({ w, s: i * 0.3, e: i * 0.3 + 0.28 }));

test("words are spelled as in the script, timings kept", () => {
  const out = respell(timed("they wanted 34,000 to fix there foundation"), "They wanted $34,000 to fix their foundation.");
  assert.equal(out.map((w) => w.w).join(" "), "They wanted $34,000 to fix their foundation.");
  assert.equal(out[2].s, 0.6);
  // Spanish accents come back from the script
  assert.equal(respell(timed("cuanto cuesta reparar"), "¿Cuánto cuesta reparar?").map((w) => w.w).join(" "), "¿Cuánto cuesta reparar?");
});

test("size 24 is the usual vertical size; options reach the subtitles", () => {
  assert.equal(fontPx(24, 1080, 1920), 96);
  const st = normalizeStyle({ look: "clasico", font: "anton", size: 32, color: "#ffe100", case: "upper", position: "arriba", words: 2 });
  const { ass } = captions(timed("we got three quotes"), 1080, 1920, "9:16", st);
  assert.match(ass, /Style: Cap,Anton,128,&H0000E1FF/);
  assert.match(ass, /,8,50,50,\d+,1/); // top alignment
  assert.match(ass, /WE GOT/);
  assert.doesNotMatch(ass, /WE GOT THREE/); // two words at most
});

test("punctuation and case options", () => {
  assert.equal(shapeWord("foundation.", { case: "normal", punct: false }), "foundation");
  assert.equal(shapeWord("$34,000", { case: "normal", punct: false }), "$34,000");
  assert.equal(shapeWord("hola,", { case: "upper", punct: true }), "HOLA,");
});

test("bad or old settings become safe ones", () => {
  assert.deepEqual(normalizeStyle({ look: "x", size: 999, color: "red" }), { ...DEFAULT_STYLE, size: 48 });
  const old = normalizeStyle({ preset: 4, size: 96 });
  assert.equal(old.case, "upper");
  assert.equal(old.size, 24);
});
