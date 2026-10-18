import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import ffmpegPath from "ffmpeg-static";
import { startTool } from "../src/lib/providers/tools";
import { findTool } from "../src/lib/tools";
import { probe, workdir } from "../src/lib/montage";
import { writeFile } from "node:fs/promises";

process.env.FAL_KEY = "test";
process.env.SUPABASE_URL = "https://sb.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "x";
process.env.ANTHROPIC_API_KEY = "test";

test("step 1 starts at the first clear moment: the frame and the video from there", { timeout: 120_000 }, async () => {
  const dir = await workdir("test-swap-src");
  const src = `${dir}/in.mp4`;
  execFileSync(ffmpegPath as unknown as string, ["-y", "-v", "error", "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=24", "-f", "lavfi", "-i", "sine", "-t", "12", "-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac", "-shortest", src]);
  const uploads: { path: string; bytes: number }[] = [];
  let nano: Record<string, unknown> | null = null;
  let claudeImages = 0;
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
    if (url === "https://video.test/in.mp4") return new Response(readFileSync(src));
    if (url.startsWith("https://api.anthropic.com")) {
      claudeImages = JSON.parse(String(init?.body)).messages[0].content.filter((b: { type: string }) => b.type === "image").length;
      return json({ content: [{ type: "text", text: '{"frame": 2}' }], stop_reason: "end_turn" });
    }
    if (url.includes("/storage/v1/bucket")) return json({});
    if (url.includes("/storage/v1/object/sign/")) return json({ signedURL: "/object/sign/x?token=t" });
    if (url.includes("/storage/v1/object/")) {
      const path = url.split("/storage/v1/object/")[1];
      const body = init?.body as Uint8Array;
      uploads.push({ path, bytes: body.byteLength });
      if (path.endsWith(".mp4")) await writeFile(`${dir}/cut.mp4`, body);
      return json({ Key: path });
    }
    if (url === "https://queue.fal.run/fal-ai/nano-banana-pro/edit") { nano = JSON.parse(String(init?.body)); return json({ response_url: "https://queue.fal.run/fal-ai/nano-banana-pro/requests/r1" }); }
    return new Response("not mocked " + url, { status: 500 });
  }) as typeof fetch;

  const job = await startTool(findTool("personaje-en-video")!, { video: "https://video.test/in.mp4", videoRef: "/api/media/ws/w01/uploads/in.mp4", videoSecs: 12, image: "https://sheet.test/s.png", sound: false }, "w01");
  assert.equal(claudeImages, 10, "one candidate per second");
  const sj = JSON.parse(job.slice("swap:".length));
  assert.equal(sj.s, 1);
  assert.equal(sj.snd, 0);
  assert.match(sj.v, /tools\/partes\//, "the video was cut to start at the chosen moment");
  assert.ok(Math.abs((await probe(`${dir}/cut.mp4`)).dur - 11) < 0.3, "12 s video from second 1 = 11 s");
  assert.ok(uploads.some((u) => u.path.includes("tools/personaje/") && u.bytes > 10_000), "the full-size frame was saved");
  assert.deepEqual((nano as unknown as { image_urls: string[] }).image_urls.length, 2);
  assert.equal((nano as unknown as { aspect_ratio: string }).aspect_ratio, "auto");
});
