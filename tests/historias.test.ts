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

test("historias: dialogue is kept only for real characters, gets its time, and goes into the video prompt", () => {
  const withTalk = {
    ...raw,
    shots: [
      { idx: 0, seconds: 2, shot: "close-up", characters: ["mentor"], image: "car window", motion: "window rolls down", dialogue: { speaker: "mentor", line: "Oye, súbete po, te voy a enseñar algo que te va a cambiar la vida" }, es: "x" },
      { idx: 1, seconds: 2, shot: "wide", characters: ["boy"], image: "street", motion: "walks", dialogue: { speaker: "ghost", line: "hola" }, es: "y" },
      ...raw.shots.slice(0, 6),
    ],
  } as unknown as StoryPlan;
  const p = tidyPlan(withTalk, 20);
  assert.equal(p.shots[0].dialogue?.speaker, "mentor");
  assert.equal(p.shots[1].dialogue, null);
  assert.ok(p.shots[0].seconds >= 5, `seconds ${p.shots[0].seconds}`);
  const m = motionPrompt(p.shots[0], "cine3d", p, "es-CL");
  assert.match(m, /súbete po/);
  assert.match(m, /Chilean Spanish/);
  assert.match(motionPrompt(p.shots[2], "cine3d", p), /No dialogue/);
});

test("historias: the dialogue writer sees the idea, the customer's context and which image is each shot", async () => {
  const { dialoguePrompt } = await import("../src/lib/historias");
  const p = tidyPlan(raw, 30);
  const t = dialoguePrompt({ idea: "niño y mentor", plan: p, lang: "es-CL", context: "Pancho habla relajado", withImages: p.shots.map((_, i) => i !== 1) });
  assert.match(t, /Pancho habla relajado/);
  assert.match(t, /#1 .*image 1/);
  assert.doesNotMatch(t.split("\n").find((l) => l.startsWith("#2")) ?? "", /image/);
  assert.match(t, /#3 .*image 2/);
  assert.match(t, /Chilean Spanish/);
});
