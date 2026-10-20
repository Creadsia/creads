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

test("new looks: karaoke fill, highlighted word that grows, entrances, glow and colour box", async () => {
  const { captions } = await import("../src/lib/montage");
  const { DEFAULT_STYLE } = await import("../src/lib/caption-style");
  const ws = [{ w: "Hola", s: 0, e: 0.4 }, { w: "mundo", s: 0.45, e: 0.9 }, { w: "lindo.", s: 0.95, e: 1.4 }];
  const run = (look: string, extra = {}) => captions(ws, 1080, 1920, "9:16", { ...DEFAULT_STYLE, look, ...extra } as never).ass;
  assert.match(run("karaoke"), /\{\\kf\d+\}Hola \{\\kf\d+\}mundo/);
  assert.match(run("salto"), /\\fscx118\\fscy118\}Hola/);
  assert.match(run("subir"), /\\move\(540,\d+,540,\d+,0,220\)\\fad\(160,0\)/);
  assert.match(run("pop"), /\\fscx70\\fscy70\\t\(/);
  assert.match(run("neon"), /\\blur\d/);
  assert.match(run("etiqueta"), /Style: Cap,[^\n]*,3,\d+,0,/);
});

test("subtitles can sit anywhere: x and y in % win over arriba / centro / abajo", async () => {
  const { captions } = await import("../src/lib/montage");
  const { DEFAULT_STYLE, normalizeStyle } = await import("../src/lib/caption-style");
  const ws = [{ w: "Hola", s: 0, e: 0.4 }];
  assert.match(captions(ws, 1080, 1920, "9:16", { ...DEFAULT_STYLE, x: 30, y: 40 }).ass, /\\an5\\pos\(324,768\)/);
  assert.match(captions(ws, 1080, 1920, "9:16", { ...DEFAULT_STYLE, position: "abajo" }).ass, /\\an2\\pos\(540,\d+\)/);
  const n = normalizeStyle({ ...DEFAULT_STYLE, x: 200, y: -5 });
  assert.equal(n.x, 92);
  assert.equal(n.y, 6);
  assert.equal(normalizeStyle({ ...DEFAULT_STYLE }).y, undefined);
});
