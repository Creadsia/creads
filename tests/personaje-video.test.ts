import { test } from "node:test";
import assert from "node:assert/strict";
import { checkTool, swapFramePrompt } from "../src/lib/providers/tools";
import { findTool } from "../src/lib/tools";

process.env.FAL_KEY = "test";
process.env.SUPABASE_URL = "https://sb.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "x";

const IMG_JOB = "https://queue.fal.run/fal-ai/nano-banana-pro/requests/abc-1";
const MOTION_JOB = "https://queue.fal.run/fal-ai/kling-video/requests/def-2";
const sent: { url: string; body: unknown }[] = [];
globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
  const url = String(input);
  const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json" } });
  if (url.endsWith("/status")) return json({ status: "COMPLETED" });
  if (url === IMG_JOB) return json({ images: [{ url: "https://fal.media/frame.png" }] });
  if (url === MOTION_JOB) return json({ video: { url: "https://fal.media/out.mp4" } });
  if (url.includes("/storage/v1/object/sign/")) return json({ signedURL: "/object/sign/vault/ws/w01/tools/partes/v.mp4?token=t" });
  if (url.startsWith("https://queue.fal.run/fal-ai/kling-video/v3/standard/motion-control")) {
    sent.push({ url, body: JSON.parse(String(init?.body)) });
    return json({ response_url: MOTION_JOB });
  }
  return new Response("not mocked " + url, { status: 500 });
}) as typeof fetch;

test("the scene instruction asks for one character only and no new objects", () => {
  const p = swapFramePrompt("keep the coffee cup");
  assert.match(p, /ONE single fictional character/);
  assert.match(p, /only ONE of this character/);
  assert.match(p, /Do not add any object/);
  assert.match(p, /keep the coffee cup/);
});

test("character in a video: picture first, then the motion from that picture, then the video", async () => {
  const t = findTool("personaje-en-video")!;
  assert.equal(t.estimate(15), 2.04);
  const step1 = `swap:${JSON.stringify({ s: 1, snd: 0, v: "/api/media/ws/w01/tools/partes/v.mp4", j: IMG_JOB })}`;
  const a = await checkTool(t, step1, "w01");
  assert.equal(a.state, "running");
  assert.ok("advance" in a && a.advance);
  const step2 = await a.advance!();
  assert.equal(sent.length, 1);
  const body = sent[0].body as Record<string, unknown>;
  assert.equal(body.image_url, "https://fal.media/frame.png");
  assert.equal(body.keep_original_sound, false);
  assert.equal(body.character_orientation, "video");
  assert.match(String(body.video_url), /^https:\/\/sb\.test\/storage\/v1\/object\/sign\//);
  const b = await checkTool(t, step2, "w01");
  assert.equal(b.state, "done");
});
