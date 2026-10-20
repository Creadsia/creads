// Veo 3.1 Google-first (Vertex, then the Gemini preview until 2026-10-22), fal.ai only as the
// emergency exit; plus Gemini Omni Flash. No real calls: fetch is mocked.
// Run: npx tsx --test tests/veo.test.ts
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { afterEach, test } from "node:test";
import { findVideo } from "../src/lib/providers";
import { serviceOfModel } from "../src/lib/balances";
import { VEO_FAL, veoRequest } from "../src/lib/providers/veo-fal";
import { serviceJwt } from "../src/lib/providers/vertex";
import { omniRequest } from "../src/lib/providers/omni";
import { GEMINI_PREVIEW_ENDS } from "../src/lib/providers/veo";

const env = { ...process.env };
const realFetch = globalThis.fetch;
const realNow = Date.now;
afterEach(() => {
  process.env = { ...env };
  globalThis.fetch = realFetch;
  Date.now = realNow;
});

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const CREDS = JSON.stringify({ client_email: "veo@creads-test.iam.gserviceaccount.com", private_key: PEM, project_id: "creads-test" });
const req = { prompt: "Una mujer muestra el producto", seconds: 8, aspect: "9:16" as const, resolution: "720p" as const, withAudio: true };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const OP = "projects/creads-test/locations/us-central1/publishers/google/models/veo-3.1-fast-generate-001/operations/abc-123";

function mock(handler: (url: string, body: Record<string, unknown> | undefined) => Response) {
  const calls: { url: string; body?: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const raw = init?.body;
    const body = typeof raw === "string" ? JSON.parse(raw) : undefined;
    calls.push({ url, body });
    return handler(url, body);
  }) as typeof fetch;
  return calls;
}

test("the service-account token request is signed with the key", () => {
  const jwt = serviceJwt({ client_email: "a@b.iam.gserviceaccount.com", private_key: PEM }, 1000);
  const [h, c, s] = jwt.split(".");
  const claims = JSON.parse(Buffer.from(c, "base64url").toString());
  assert.equal(claims.iss, "a@b.iam.gserviceaccount.com");
  assert.equal(claims.exp, 4600);
  assert.ok(createVerify("RSA-SHA256").update(`${h}.${c}`).verify(publicKey, Buffer.from(s, "base64url")));
});

test("with Vertex connected: the clip goes to Google Vertex, and the video is read back from the operation", async () => {
  process.env.GOOGLE_VERTEX_CREDENTIALS = Buffer.from(CREDS).toString("base64");
  process.env.FAL_KEY = "fal-test";
  const p = findVideo("veo-3.1-fast")!;
  assert.equal(p.usdPerSecond, 0.15);
  let done = false;
  const calls = mock((url) => {
    if (url.includes("oauth2")) return json({ access_token: "tok", expires_in: 3600 });
    if (url.endsWith(":predictLongRunning")) return json({ name: OP });
    return json(done ? { name: OP, done: true, response: { videos: [{ bytesBase64Encoded: Buffer.from("MP4").toString("base64"), mimeType: "video/mp4" }] } } : { name: OP });
  });
  const job = await p.submit(req);
  assert.equal(job.jobId, `vertex:${OP}`);
  const sent = calls.find((c) => c.url.endsWith(":predictLongRunning"))!;
  assert.match(sent.url, /projects\/creads-test\/locations\/us-central1\/publishers\/google\/models\/veo-3\.1-fast-generate-001/);
  assert.deepEqual((sent.body as { parameters: object }).parameters, { aspectRatio: "9:16", durationSeconds: 8, resolution: "720p", generateAudio: true, personGeneration: "allow_adult", sampleCount: 1 });
  assert.equal((await p.status(job)).state, "running");
  done = true;
  const st = await p.status(job);
  assert.deepEqual(st, { state: "done", url: `vertex:${OP}` });
  assert.equal(Buffer.from(await p.download!(`vertex:${OP}`)).toString(), "MP4");
  assert.ok(!calls.some((c) => c.url.includes("fal.run")), "fal never touched");
});

test("Google refuses the clip: the same clip goes to fal, the customer never notices", async () => {
  process.env.GOOGLE_VERTEX_CREDENTIALS = CREDS;
  process.env.FAL_KEY = "fal-test";
  delete process.env.GEMINI_API_KEY;
  const p = findVideo("veo-3.1")!;
  const calls = mock((url) => {
    if (url.includes("oauth2")) return json({ access_token: "tok", expires_in: 3600 });
    if (url.includes("aiplatform")) return json({ error: { message: "Quota exceeded" } }, 429);
    return json({ response_url: "https://queue.fal.run/fal-ai/veo3.1/requests/r-1" });
  });
  const job = await p.submit(req);
  assert.equal(job.provider, "veo-3.1");
  assert.match(calls.at(-1)!.url, /queue\.fal\.run\/fal-ai\/veo3\.1$/);
  mock(() => json({ status: "IN_PROGRESS" }));
  assert.equal((await p.status(job)).state, "running", "a fal job is still polled on fal");
});

test("without Vertex: the Gemini preview until 22 Oct, then fal", async () => {
  delete process.env.GOOGLE_VERTEX_CREDENTIALS;
  process.env.GEMINI_API_KEY = "g-test";
  process.env.FAL_KEY = "fal-test";
  const p = findVideo("veo-3.1-fast")!;
  Date.now = () => GEMINI_PREVIEW_ENDS - 60_000;
  let calls = mock((url) => (url.includes("generativelanguage") ? json({ name: "models/veo-3.1-fast-generate-preview/operations/op1" }) : json({ response_url: "https://queue.fal.run/x/requests/r" })));
  assert.equal((await p.submit(req)).jobId, "models/veo-3.1-fast-generate-preview/operations/op1");
  assert.match(calls[0].url, /veo-3\.1-fast-generate-preview:predictLongRunning/);
  Date.now = () => GEMINI_PREVIEW_ENDS + 1;
  calls = mock(() => json({ response_url: "https://queue.fal.run/fal-ai/veo3.1/fast/requests/r-2" }));
  await p.submit(req);
  assert.match(calls[0].url, /queue\.fal\.run\/fal-ai\/veo3\.1\/fast$/);
});

test("fal's Veo request (emergency exit): endpoints and lengths", () => {
  const [fast, std] = VEO_FAL;
  assert.equal(veoRequest(fast, req).endpoint, "fal-ai/veo3.1/fast");
  assert.equal(veoRequest(fast, { ...req, seconds: 5, refs: [{ url: "https://x/f.png", role: "first_frame" }] }).endpoint, "fal-ai/veo3.1/fast/image-to-video");
  const ref = veoRequest(std, { ...req, seconds: 4, refs: [{ url: "https://x/face.png", role: "face" }] });
  assert.equal(ref.endpoint, "fal-ai/veo3.1/reference-to-video");
  assert.equal((ref.body as { duration: string }).duration, "8s");
});

test("Gemini Omni Flash: the request, and Veo/Omni are paid to Google", () => {
  const t = omniRequest(req);
  assert.equal(t.model, "gemini-omni-1.1-flash");
  assert.equal(t.background, true);
  assert.deepEqual(t.response_format, { type: "video", aspect_ratio: "9:16", resolution: "720p" });
  assert.equal(t.generation_config.video_config.task, "text_to_video");
  const withFrame = omniRequest(req, { data: "AAA", mimeType: "image/png" });
  assert.equal(withFrame.generation_config.video_config.task, "image_to_video");
  assert.deepEqual((withFrame.input as object[])[0], { type: "image", data: "AAA", mime_type: "image/png" });
  assert.throws(() => omniRequest({ ...req, aspect: "4:5" }), /9:16 o 16:9/);
  assert.equal(findVideo("gemini-omni-flash")!.usdPerSecond, 0.1);
  assert.equal(findVideo("veo-3.1-lite"), undefined);
  assert.equal(serviceOfModel("veo-3.1-fast"), "google");
  assert.equal(serviceOfModel("gemini-omni-flash"), "google");
});
