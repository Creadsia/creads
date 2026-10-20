// «Varias imágenes a la vez»: the prompts that ask for N different ad images and check each one.
// Run: npx tsx --test tests/image-batch.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { IMAGE_STYLES, ideasPrompt, reviewPrompt } from "../src/lib/image-batch";

test("the ideas prompt asks for exactly N different images in the chosen style and format", () => {
  const p = ideasPrompt("Crema antiarrugas para mujeres de 40", "cartel", 8, "4:5");
  assert.match(p, /8 DIFFERENT images/);
  assert.match(p, /exactly 8 prompts/);
  assert.match(p, /cardboard sign/);
  assert.match(p, /safe zone/);
  assert.match(p, /no celebrities/);
  assert.doesNotMatch(ideasPrompt("x", "libre", 2, "16:9"), /safe zone/);
});

test("all the prototype's styles are back, and the review only flags serious problems", () => {
  assert.deepEqual(IMAGE_STYLES.map((s) => s.id), ["libre", "producto", "cartel", "selfie", "antesdespues", "nativo", "texto"]);
  assert.match(reviewPrompt("a sign"), /misspelled/);
});
