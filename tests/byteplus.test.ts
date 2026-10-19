// Seedance bought direct from BytePlus, with fal as the fallback. No real calls: fetch is mocked.
// Run: npx tsx --test tests/byteplus.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { DIRECT_SHARE, arkTask } from "../src/lib/providers/byteplus";
import { findVideo } from "../src/lib/providers";

process.env.FAL_KEY = "fal-test";
const req = { prompt: "Una mujer muestra el producto", seconds: 8, aspect: "9:16" as const, resolution: "720p" as const, withAudio: true };

type Call = { url: string; body?: Record<string, unknown>; auth: string | null };
function mock(handler: (url: string) => Response) {
  const calls: Call[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined, auth: new Headers(init?.headers).get("authorization") });
    return handler(url);
  }) as typeof fetch;
  return calls;
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

test("the task BytePlus receives: model, prompt, first frame, adaptive ratio with an image, audio", () => {
  const t = arkTask("dreamina-seedance-2-0-260128", { ...req, refs: [] }, "https://x/frame.png");
  assert.equal(t.model, "dreamina-seedance-2-0-260128");
  assert.deepEqual(t.content[1], { type: "image_url", image_url: { url: "https://x/frame.png" }, role: "first_frame" });
  assert.equal(t.ratio, "adaptive");
  assert.equal(t.duration, 8);
  assert.equal(t.generate_audio, true);
  assert.equal(t.watermark, false);
  assert.equal(arkTask("m", { ...req, aspect: "4:5", seconds: 2 }).ratio, "3:4");
  assert.equal(arkTask("m", { ...req, seconds: 2 }).duration, 4, "shortest Seedance clip");
});

test("without the BytePlus key: everything stays on fal at fal's price", async () => {
  delete process.env.BYTEPLUS_API_KEY;
  const p = findVideo("seedance-2.0")!;
  assert.equal(p.usdPerSecond, 0.3024);
  const calls = mock(() => json({ response_url: "https://queue.fal.run/bytedance/seedance-2.0/requests/abc-1" }));
  const job = await p.submit(req);
  assert.match(calls[0].url, /queue\.fal\.run/);
  assert.doesNotMatch(job.jobId, /^ark:/);
});

test("with the key: BytePlus first, 25% cheaper for the customer, result read from BytePlus", async () => {
  process.env.BYTEPLUS_API_KEY = "bp-test";
  const p = findVideo("seedance-2.0")!;
  assert.equal(DIRECT_SHARE, 0.75);
  assert.equal(p.usdPerSecond, +(0.3024 * 0.75).toFixed(4));
  let state = "running";
  const calls = mock((url) =>
    url.endsWith("/contents/generations/tasks")
      ? json({ id: "cgt-2026abc" })
      : json({ id: "cgt-2026abc", status: state, content: { video_url: "https://cdn.bp/out.mp4" } }),
  );
  const job = await p.submit({ ...req, refs: [{ url: "https://x/f.png", role: "first_frame" }] });
  assert.equal(job.jobId, "ark:cgt-2026abc");
  assert.equal(calls[0].auth, "Bearer bp-test");
  assert.equal((calls[0].body as { model: string }).model, "dreamina-seedance-2-0-260128");
  assert.equal((await p.status(job)).state, "running");
  state = "succeeded";
  assert.deepEqual(await p.status(job), { state: "done", url: "https://cdn.bp/out.mp4" });
  assert.match(calls.at(-1)!.url, /\/tasks\/cgt-2026abc$/);
  state = "failed";
  assert.equal((await p.status(job)).state, "failed");
});

test("BytePlus out of balance (or down): the same job goes to fal, the customer never notices", async () => {
  process.env.BYTEPLUS_API_KEY = "bp-test";
  const p = findVideo("seedance-2.5")!;
  const calls = mock((url) =>
    url.includes("bytepluses.com")
      ? json({ error: { code: "AccountOverdueError", message: "overdue" } }, 403)
      : json({ response_url: "https://queue.fal.run/bytedance/seedance-2.5/requests/abc-2" }),
  );
  const job = await p.submit(req);
  assert.equal(calls.length, 2);
  assert.equal(job.jobId, "https://queue.fal.run/bytedance/seedance-2.5/requests/abc-2");
  // a job started on fal is still polled on fal
  mock(() => json({ status: "IN_PROGRESS" }));
  assert.equal((await p.status(job)).state, "running");
});

test("other models are untouched", () => {
  process.env.BYTEPLUS_API_KEY = "bp-test";
  assert.equal(findVideo("kling-3.0")!.usdPerSecond, 0.14);
  delete process.env.BYTEPLUS_API_KEY;
});
