// Playback speed: the pure timing-scaling math, the project cleaner, and that the export speeds the video.
// Run: npx tsx --test tests/editor-velocidad.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { clampVelocidad, escalar, escalarPalabras, escalarTextos, limpiarProyecto } from "../src/lib/editor";

test("clampVelocidad keeps a safe number in [0.5, 2], 1 by default", () => {
  assert.equal(clampVelocidad(1), 1);
  assert.equal(clampVelocidad(1.5), 1.5);
  assert.equal(clampVelocidad(2), 2);
  assert.equal(clampVelocidad(5), 2);      // over the top
  assert.equal(clampVelocidad(0.1), 0.5);  // under the floor
  assert.equal(clampVelocidad("1.25"), 1.25);
  assert.equal(clampVelocidad(undefined), 1);
  assert.equal(clampVelocidad("rápido"), 1);
  assert.equal(clampVelocidad(1.238), 1.24); // rounded to hundredths
});

test("escalar maps a source second onto the sped-up output timeline (t / velocidad)", () => {
  assert.equal(escalar(10, 1), 10);
  assert.equal(escalar(10, 2), 5);
  assert.equal(escalar(12, 1.5), 8);
  assert.equal(escalar(6, 1.2), 5);
});

test("escalarPalabras and escalarTextos scale every timing, and are a no-op at 1x", () => {
  const words = [{ w: "hola", s: 2, e: 2.4 }, { w: "mundo", s: 2.4, e: 3 }];
  assert.deepEqual(escalarPalabras(words, 2), [{ w: "hola", s: 1, e: 1.2 }, { w: "mundo", s: 1.2, e: 1.5 }]);
  assert.strictEqual(escalarPalabras(words, 1), words); // same reference: nothing to do at 1x

  const textos = [{ id: "t1", desde: 4, hasta: 8 }];
  assert.deepEqual(escalarTextos(textos, 2), [{ id: "t1", desde: 2, hasta: 4 }]);
  assert.strictEqual(escalarTextos(textos, 1), textos);
});

test("the project cleaner stores a safe velocidad", () => {
  const clips = new Set(["c1"]);
  assert.equal(limpiarProyecto({ cortes: [{ clipId: "c1", a: 0, b: 5 }] }, clips).velocidad, 1); // default
  assert.equal(limpiarProyecto({ cortes: [{ clipId: "c1", a: 0, b: 5 }], velocidad: 1.5 }, clips).velocidad, 1.5);
  assert.equal(limpiarProyecto({ cortes: [{ clipId: "c1", a: 0, b: 5 }], velocidad: 9 }, clips).velocidad, 2);
});
