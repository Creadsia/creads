import { test } from "node:test";
import assert from "node:assert/strict";
import { characterPrompt, keyframePrompt, motionPrompt, shotsFor, tidyPlan, type StoryPlan } from "../src/lib/historias";

const raw = {
  title: "El chico que nadie veía", logline: "x", music: "epic",
  characters: [{ key: "Boy!", name: "Mateo", look: "15-year-old boy, curly black hair, white t-shirt" }, { key: "mentor", name: "Leo", look: "30s, long curly hair, black tee, gold chain" }, { key: "", name: "x", look: "" }],
  shots: Array.from({ length: 30 }, (_, i) => ({ idx: i, seconds: 3, shot: "close-up", characters: i % 2 ? ["boy", "ghost"] : ["mentor"], image: `scene ${i} with [boy]`, motion: "push in", narration: "", es: `toma ${i}` })),
} as unknown as StoryPlan;

test("historias: plan is cleaned — valid keys, max 24 shots, lengths add up to the target", () => {
  const p = tidyPlan(raw, 60);
  assert.deepEqual(p.characters.map((c) => c.key), ["boy", "mentor"]);
  assert.equal(p.shots.length, 24);
  assert.deepEqual(p.shots[1].characters, ["boy"]); // unknown "ghost" dropped
  const total = p.shots.reduce((a, s) => a + s.seconds, 0);
  assert.ok(Math.abs(total - 60) < 3, `total ${total}`);
  assert.ok(p.shots.every((s) => s.seconds >= 1.5 && s.seconds <= 5));
  assert.equal(shotsFor(30), 12);
});

test("historias: prompts tie each shot to the character sheets and ask for no text", () => {
  const p = tidyPlan(raw, 30);
  const k = keyframePrompt(p.shots[1], p, "cine3d", "9:16");
  assert.match(k, /reference image 1/);
  assert.match(k, /Mateo/);
  assert.match(k, /No text/);
  assert.match(characterPrompt(p.characters[0], "anime"), /anime/i);
  assert.ok(motionPrompt(p.shots[0], "cine3d").length <= 2400);
});
