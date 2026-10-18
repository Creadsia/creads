import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";
import { checkTool, startTool, swapFramePrompt } from "../src/lib/providers/tools";
import { candidateTimes, judge, motionPrompt } from "../src/lib/influencer/swap";
import { summarize } from "../src/lib/calidad";
import { findTool } from "../src/lib/tools";
import { probe, workdir } from "../src/lib/montage";
import { writeFile } from "node:fs/promises";

process.env.FAL_KEY = "test";
process.env.SUPABASE_URL = "https://sb.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
process.env.ANTHROPIC_API_KEY = "test";

const t = findTool("personaje-en-video")!;
const seen = (o: Partial<Parameters<typeof judge>[2] & object> = {}) => ({ first_clear: 0, people: "one" as const, hands: "none" as const, fast: false, face_hidden: false, ...o });

test("the check before charging: red, yellow and green in plain words", () => {
  const times = candidateTimes(15);
  assert.equal(times[0], 0);
  assert.ok(times.every((x) => x === 0 || x <= 11.8));
  const red = judge(15, times, seen({ first_clear: -1 }), []);
  assert.equal(red.level, "rojo");
  assert.match(red.checks[0].text, /cintura para arriba/);
  const green = judge(15, times, seen({ first_clear: 6, hands: "small", hands_what: "un vaso" }), []);
  assert.equal(green.level, "verde");
  assert.equal(green.start, 5);
  assert.equal(green.usable, 10);
  const yellow = judge(15, times, seen({ people: "similar", hands: "big", hands_what: "una bolsa" }), [9]);
  assert.equal(yellow.level, "amarillo");
  assert.equal(yellow.usable, 9, "only the first shot is used");
  assert.ok(yellow.checks.some((c) => /bolsa/.test(c.text)));
  assert.equal(judge(15, times, seen({ first_clear: 2 }), [2.5]).level, "rojo", "less than 3 s of one shot left");
});

test("the instructions ask for one character, the locked face and no new objects", () => {
  const p = swapFramePrompt("keep the coffee cup");
  assert.match(p, /ONE single fictional character/);
  assert.match(p, /only ONE of this character/);
  assert.match(p, /Do not add any object/);
  assert.match(p, /keep the coffee cup/);
  assert.match(motionPrompt({ withFace: true }), /^@Element1/);
});

// ---------------- the whole job with fake services
const IMG1 = "https://queue.fal.run/fal-ai/nano-banana-pro/requests/i-1";
const IMG2 = "https://queue.fal.run/fal-ai/nano-banana-pro/requests/i-2";
const MOT1 = "https://queue.fal.run/fal-ai/kling-video/requests/m-1";
const MOT2 = "https://queue.fal.run/fal-ai/kling-video/requests/m-2";
let claudeSays: string[] = [];
const submitted: { url: string; body: Record<string, unknown> }[] = [];
let dir = "";

test("a 12 s video: starts where the person is seen, face locked, reviews, one free redo each", { timeout: 180_000 }, async () => {
  dir = await workdir("test-swap");
  const src = `${dir}/in.mp4`;
  execFileSync(ffmpegPath as unknown as string, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=24", "-f", "lavfi", "-i", "sine", "-t", "12", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", src]);
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (url === "https://video.test/in.mp4" || url === "https://fal.media/out.mp4") return new Response(readFileSync(src));
    if (url.startsWith("https://api.anthropic.com")) return json({ content: [{ type: "text", text: claudeSays.shift() ?? '{"severe": false, "issues": []}' }], stop_reason: "end_turn" });
    if (url.includes("/storage/v1/bucket")) return json({});
    if (url.includes("/storage/v1/object/sign/")) return json({ signedURL: "/object/sign/x?token=t" });
    if (url.includes("/storage/v1/object/")) {
      const body = init?.body as Uint8Array;
      if (url.endsWith(".mp4")) await writeFile(`${dir}/cut.mp4`, body);
      return json({ Key: "k" });
    }
    if (url.endsWith("/status")) return json({ status: "COMPLETED" });
    if (url === IMG1 || url === IMG2) return json({ images: [{ url: "https://fal.media/frame.png" }] });
    if (url === MOT1 || url === MOT2) return json({ video: { url: "https://fal.media/out.mp4" } });
    if (url.startsWith("https://queue.fal.run/")) {
      submitted.push({ url, body: JSON.parse(String(init?.body)) });
      const nano = url.includes("nano-banana");
      const n = submitted.filter((x) => x.url.includes(nano ? "nano-banana" : "motion-control")).length;
      return json({ response_url: nano ? (n === 1 ? IMG1 : IMG2) : n === 1 ? MOT1 : MOT2 });
    }
    return new Response("not mocked " + url, { status: 500 });
  }) as typeof fetch;

  const face = { front: "/api/media/ws/w01/personajes/face.jpg", refs: ["/api/media/ws/w01/personajes/body.jpg"] };
  const analysis = judge(12, candidateTimes(12), seen({ first_clear: 2, main: "bald man in black" }), []);
  let job = await startTool(t, { video: "https://video.test/in.mp4", videoRef: "/api/media/ws/w01/up/in.mp4", videoSecs: 12, image: "https://sheet.test/s.png", imageRef: "/api/media/ws/w01/tools/crear-personaje/s.png", sound: false, analysis, face }, "w01");
  assert.ok(Math.abs((await probe(`${dir}/cut.mp4`)).dur - 11) < 0.3, "starts at second 1");
  const nano1 = submitted[0].body as { image_urls: string[]; prompt: string };
  assert.equal(nano1.image_urls.length, 3, "frame + sheet + face");
  assert.match(nano1.prompt, /bald man in black/);

  // step 1 done, the review finds a double: redone once, free
  claudeSays = ['{"severe": true, "issues": ["the character appears twice"]}', '{"nuevas": [], "repetidas": []}'];
  let st = await checkTool(t, job, "w01");
  assert.ok("advance" in st && st.advance);
  job = await st.advance!();
  assert.equal(JSON.parse(job.slice(5)).r1, 1);
  assert.match((submitted[1].body as { prompt: string }).prompt, /appears twice/);

  // the redo is clean: the motion starts with the face locked
  claudeSays = ['{"severe": false, "issues": []}'];
  st = await checkTool(t, job, "w01");
  job = await (st as { advance: () => Promise<string> }).advance();
  const mot = submitted[2].body as { elements: { frontal_image_url: string; reference_image_urls: string[] }[]; keep_original_sound: boolean; prompt: string; image_url: string };
  assert.equal(mot.image_url, "https://fal.media/frame.png");
  assert.equal(mot.elements.length, 1);
  assert.equal(mot.elements[0].reference_image_urls.length, 1);
  assert.equal(mot.keep_original_sound, false);
  assert.match(mot.prompt, /@Element1/);

  // final review: severe once → redone free; then fine → delivered
  claudeSays = ['{"severe": true, "issues": ["the coffee cup duplicates"]}', '{"nuevas": [], "repetidas": []}'];
  st = await checkTool(t, job, "w01");
  job = await (st as { advance: () => Promise<string> }).advance();
  assert.equal(JSON.parse(job.slice(5)).r2, 1);
  assert.match((submitted[3].body as { prompt: string }).prompt, /coffee cup duplicates/);
  claudeSays = ['{"severe": false, "issues": []}'];
  st = await checkTool(t, job, "w01");
  job = await (st as { advance: () => Promise<string> }).advance();
  assert.equal(JSON.parse(job.slice(5)).qa, "ok");
  st = await checkTool(t, job, "w01");
  assert.equal(st.state, "done");

  // and the quality panel reads it back
  const q = summarize([{ status: "done", kind: "tool:personaje-en-video", model: null, error: null, provider_job: job, created_at: "" }, { status: "failed", kind: "tool:personaje-en-video", model: null, error: "No se vio el cuerpo 12", provider_job: null, created_at: "" }], 30);
  assert.equal(q.personaje.listos, 1);
  assert.equal(q.personaje.limpios, 0);
  assert.equal(q.personaje.rehechosEscena, 1);
  assert.equal(q.personaje.rehechosVideo, 1);
  assert.equal(q.motivos[0].veces, 1);
});

test("a scene still wrong after the free redo stops (and is refunded) before the expensive step", async () => {
  const job = `swap:${JSON.stringify({ s: 1, snd: 1, v: "/api/media/ws/w01/up/in.mp4", of: "/api/media/ws/w01/f.jpg", sh: "/api/media/ws/w01/s.png", j: IMG1, r1: 1 })}`;
  claudeSays = ['{"severe": true, "issues": ["two characters"]}', '{"nuevas": [], "repetidas": []}'];
  const before = submitted.length;
  const st = await checkTool(t, job, "w01");
  await assert.rejects(() => (st as { advance: () => Promise<string> }).advance(), /Te devolvimos los créditos/);
  assert.equal(submitted.length, before, "no motion was paid for");
});
