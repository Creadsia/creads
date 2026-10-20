// Grok video bought straight from xAI (Lite and Grok Imagine only there; 1.5 with fal as the fallback).
// No real calls: fetch is mocked. Run: npx tsx --test tests/xai-video.test.ts
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { xaiTask } from "../src/lib/providers/xai-video";
import { findVideo, videoProviders } from "../src/lib/providers";
import { serviceOfModel } from "../src/lib/balances";

const env = { ...process.env };
const realFetch = globalThis.fetch;
afterEach(() => { process.env = { ...env }; globalThis.fetch = realFetch; });
const req = { prompt: "Una mujer muestra una crema", seconds: 7, aspect: "9:16" as const, resolution: "720p" as const, withAudio: true };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
function mock(handler: (url: string) => Response) {
  const calls: { url: string; body?: Record<string, unknown>; auth: string | null }[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined, auth: new Headers(init?.headers).get("authorization") });
    return handler(url);
  }) as typeof fetch;
  return calls;
}

test("the job xAI receives: model, prompt, 720p, nearest length; a starting image replaces the format", () => {
  assert.deepEqual(xaiTask("grok-imagine-video-1.5-lite", req), { model: "grok-imagine-video-1.5-lite", prompt: req.prompt, aspect_ratio: "9:16", duration: 6, resolution: "720p" });
  const i2v = xaiTask("m", { ...req, refs: [{ url: "https://x/f.png", role: "first_frame" }] }) as Record<string, unknown>;
  assert.deepEqual(i2v.image, { url: "https://x/f.png" });
  assert.equal("aspect_ratio" in i2v, false);
  assert.equal((xaiTask("m", { ...req, aspect: "4:5" }) as Record<string, unknown>).aspect_ratio, "9:16");
});

test("Grok Lite is the first and cheapest video, paid to xAI", async () => {
  process.env.XAI_API_KEY = "xai-test";
  const p = findVideo("grok-video-lite")!;
  assert.equal(videoProviders[0].id, "grok-video-lite");
  assert.equal(p.usdPerSecond, 0.03);
  assert.equal(serviceOfModel("grok-video-lite"), "xai");
  let status = "pending";
  const calls = mock((url) => (url.endsWith("/videos/generations") ? json({ request_id: "req-123" }) : json({ status, video: { url: "https://vidgen.x.ai/v.mp4" } })));
  const job = await p.submit(req);
  assert.equal(job.jobId, "xai:req-123");
  assert.equal(calls[0].auth, "Bearer xai-test");
  assert.equal((calls[0].body as { model: string }).model, "grok-imagine-video-1.5-lite");
  assert.equal((await p.status(job)).state, "running");
  status = "done";
  assert.deepEqual(await p.status(job), { state: "done", url: "https://vidgen.x.ai/v.mp4" });
  status = "failed";
  assert.equal((await p.status(job)).state, "failed");
});

test("Grok 1.5: xAI first; if xAI refuses, the same job goes to fal", async () => {
  process.env.XAI_API_KEY = "xai-test";
  process.env.FAL_KEY = "fal-test";
  const p = findVideo("grok-video-1.5")!;
  let calls = mock(() => json({ request_id: "r-9" }));
  assert.equal((await p.submit(req)).jobId, "xai:r-9");
  assert.match(calls[0].url, /api\.x\.ai/);
  calls = mock((url) => (url.includes("api.x.ai") ? json({ error: "insufficient credits" }, 402) : json({ response_url: "https://queue.fal.run/xai/grok/requests/r-1" })));
  const job = await p.submit(req);
  assert.equal(calls.length, 2);
  assert.doesNotMatch(job.jobId, /^xai:/);
});
