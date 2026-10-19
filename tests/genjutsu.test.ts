import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";
import { checkTool, startTool, swapStep, toolConfigured } from "../src/lib/providers/tools";
import { findTool } from "../src/lib/tools";
import { probe, workdir } from "../src/lib/montage";
import { writeFile } from "node:fs/promises";

process.env.COMFY_API_KEY = "test-comfy-key-123";
process.env.SUPABASE_URL = "https://sb.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
process.env.ANTHROPIC_API_KEY = "test";

const t = findTool("personaje-genjutsu")!;
const BASE = "https://api.comfy.org/v2/models/higgsfield/higgsfield-genjutsu-motion-transfer-v1.0";

test("Máxima calidad: priced per second, needs the Comfy key", () => {
  assert.equal(t.estimate(15), 5.25);
  assert.equal(t.estimate(2), 1.4, "at least 4 s");
  assert.equal(toolConfigured(t), true);
});

test("recasts with the clean references (body + face), reviews, redoes once free, delivers silent", { timeout: 120_000 }, async () => {
  const dir = await workdir("test-gj");
  const src = `${dir}/out.mp4`;
  execFileSync(ffmpegPath as unknown as string, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=480x848:rate=24", "-f", "lavfi", "-i", "sine", "-t", "6", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", src]);
  const sent: { body: Record<string, unknown>; idem: string | null; key: string | null }[] = [];
  let polls = 0;
  let claudeSays: string[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const h = new Headers(init?.headers);
    const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
    if (url === `${BASE}/requests`) {
      sent.push({ body: JSON.parse(String(init?.body)), idem: h.get("Idempotency-Key"), key: h.get("X-API-Key") });
      return json({ request_id: `req-${sent.length}abc`, status: "IN_QUEUE", queue_position: 0 }, 201);
    }
    if (url.startsWith(`${BASE}/requests/`)) {
      polls++;
      return polls === 1 ? json({ status: "IN_PROGRESS" }, 202) : json({ status: "completed", video: { url: "https://cdn.test/out.mp4" } });
    }
    if (url === "https://cdn.test/out.mp4") return new Response(readFileSync(src));
    if (url.startsWith("https://api.anthropic.com")) return json({ content: [{ type: "text", text: claudeSays.shift() ?? '{"severe": false, "issues": []}' }], stop_reason: "end_turn" });
    if (url.includes("/storage/v1/object/sign/")) return json({ signedURL: `/object/sign/${url.split("/sign/")[1]}?token=t` });
    if (url.includes("/storage/v1/")) return json({});
    return new Response("not mocked " + url, { status: 500 });
  }) as typeof fetch;

  const face = { front: "/api/media/ws/w01/personajes/face.jpg", refs: ["/api/media/ws/w01/personajes/body.jpg"] };
  let job = await startTool(t, { video: "https://v.test/v.mp4", videoRef: "/api/media/ws/w01/up/v.mp4", image: "https://s.test/s.png", imageRef: "/api/media/ws/w01/tools/crear-personaje/s.png", sound: false, face }, "w01");
  assert.equal(sent[0].key, "test-comfy-key-123");
  assert.ok(sent[0].idem && sent[0].idem.length > 10, "idempotency key sent");
  const b = sent[0].body as { image_urls: string[]; video_url: string; resolution: string; prompt: string };
  assert.equal(b.image_urls.length, 2);
  assert.match(b.image_urls[0], /body\.jpg/, "whole character first");
  assert.match(b.image_urls[1], /face\.jpg/);
  assert.doesNotMatch(b.image_urls.join(" "), /crear-personaje/, "never the 4-view sheet");
  assert.equal(b.resolution, "720p");
  assert.match(b.prompt, /ONE single character/);
  assert.match(swapStep(job) ?? "", /entrando al video/);

  assert.equal((await checkTool(t, job, "w01")).state, "running");
  // done → review finds a double → redone free
  claudeSays = ['{"severe": true, "issues": ["two copies of the character"]}', '{"nuevas": [], "repetidas": []}'];
  let st = await checkTool(t, job, "w01");
  job = await (st as { advance: () => Promise<string> }).advance();
  assert.equal(sent.length, 2);
  assert.match(String(sent[1].body.prompt), /two copies/);
  assert.equal(JSON.parse(job.slice(3)).r, 1);
  // the redo is clean → delivered without sound
  claudeSays = ['{"severe": false, "issues": []}'];
  st = await checkTool(t, job, "w01");
  job = await (st as { advance: () => Promise<string> }).advance();
  st = await checkTool(t, job, "w01");
  assert.equal(st.state, "done");
  const bytes = await (st as { fetch: () => Promise<ArrayBuffer> }).fetch();
  await writeFile(`${dir}/got.mp4`, Buffer.from(bytes));
  const p = await probe(`${dir}/got.mp4`);
  assert.equal(p.audio, false);
  assert.ok(Math.abs(p.dur - 6) < 0.3);
});

test("Comfy errors come back in plain words", async () => {
  globalThis.fetch = (async (input: string | URL) => (String(input).includes("api.comfy.org")
    ? new Response("{}", { status: 402, headers: { "x-comfy-error-type": "insufficient_credits" } })
    : new Response(JSON.stringify({ signedURL: "/object/sign/x?token=t" }), { status: 200 }))) as typeof fetch;
  await assert.rejects(() => startTool(t, { video: "https://v.test/v.mp4", videoRef: "/api/media/ws/w01/up/v.mp4", image: "https://s.test/s.png", imageRef: "/api/media/ws/w01/x/s.png" }, "w01"), /saldo en Comfy/);
});
