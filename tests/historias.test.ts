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

test("historias: sound options, song lyrics, context and the readable script", async () => {
  const h = await import("../src/lib/historias");
  // every preset is reachable and recognized back
  for (const p of h.SOUND_PRESETS) assert.equal(h.presetOf(p), p.id);
  assert.equal(h.musicModeOf({}), "ia"); // stories made before the option keep their AI music
  assert.equal(h.musicModeOf({ music_mode: "ninguna" }), "ninguna");
  // Chilean Spanish without slang by default; the plan follows the customer's notes and writes lyrics for a song
  const t = h.planPrompt({ idea: "Tomás conoce a Pancho, un mentor que le enseña a vender", style: "anime", seconds: 30, lang: "es-CL", narrator: false, dialogue: true, aspect: "9:16", context: "Pancho habla relajado", music: "cancion" });
  assert.match(t, /never "po", "cachai"/);
  assert.match(t, /Pancho habla relajado/);
  assert.match(t, /"lyrics": the song's lyrics/);
  assert.match(t, /happens in Chile/);
  assert.doesNotMatch(h.planPrompt({ idea: "x".repeat(20), style: "anime", seconds: 30, lang: "es", narrator: false, aspect: "9:16" }), /happens in Chile/);
  // ambient sound is asked only for shots where nobody speaks
  const shot = { idx: 0, seconds: 3, shot: "wide", characters: [], image: "a park", motion: "slow pan", es: "Un parque" };
  assert.match(h.motionPrompt(shot, "anime", undefined, "es-CL", true), /ambient sound/);
  assert.doesNotMatch(h.motionPrompt(shot, "anime", undefined, "es-CL", false), /ambient sound/);
  // the script reads like a film script
  const plan = h.tidyPlan({ title: "El mentor", logline: "Un niño aprende a vender.", music: "pop", lyrics: "Línea uno\nLínea dos\nCoro", characters: [{ key: "pancho", name: "Pancho", look: "man, 30" }], shots: [{ idx: 0, seconds: 3, shot: "close", characters: ["pancho"], image: "plaza", motion: "push", es: "Pancho sonríe", dialogue: { speaker: "pancho", line: "El colegio te enseña a sumar" } }] } as never, 30);
  const sc = h.storyScript(plan, { narrator: false, music_mode: "cancion" });
  assert.match(sc, /Pancho: «El colegio te enseña a sumar»/);
  assert.match(sc, /LETRA\nLínea uno/);
  assert.match(h.storyScript(plan, { music_mode: "ninguna" }), /sin música/);
});

test("historias: one saved track per kind; a song is remade only when its lyrics change", async () => {
  const h = await import("../src/lib/historias");
  const st = { music_by: { cancion: { url: "/api/media/ws/a/s.mp3", secs: 32, lyrics: "uno\ndos\ntres" } }, music_url: "/api/media/ws/a/i.mp3", music_secs: 32 };
  assert.equal(h.savedTrack(st, "ia")?.url, "/api/media/ws/a/i.mp3"); // stories from before keep their instrumental
  assert.equal(h.needsNewTrack(st, "ia", 30, ""), false);
  assert.equal(h.needsNewTrack(st, "cancion", 30, "uno\ndos\ntres"), false); // switching back doesn't pay again
  assert.equal(h.needsNewTrack(st, "cancion", 30, "uno\ndos\ncuatro"), true); // new lyrics, new song
  assert.equal(h.needsNewTrack(st, "cancion", 40, "uno\ndos\ntres"), true); // longer film
  assert.equal(h.needsNewTrack(st, "ia", 30, "", true), true); // «Otra música»
  assert.equal(h.needsNewTrack({}, "cancion", 30, "x"), true);
});
