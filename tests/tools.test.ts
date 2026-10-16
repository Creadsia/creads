import { test } from "node:test";
import assert from "node:assert/strict";
import { toolRequest, videoEditPrompt } from "../src/lib/providers/tools";
import { findTool } from "../src/lib/tools";

test("video edit: «foto N» becomes @ImageN, unnamed photos are still referenced", () => {
  assert.equal(videoEditPrompt("cambia la cara por la de la foto 1 y el fondo por la foto 2", 2), "cambia la cara por la de la @Image1 y el fondo por la @Image2");
  assert.equal(videoEditPrompt("ponle una polera roja", 0), "ponle una polera roja");
  assert.equal(videoEditPrompt("usa esta cara", 1), "usa esta cara (@Image1)");
});

test("video edit: request keeps the audio and only sends photos when there are some", () => {
  const a = toolRequest("editar-video", { video: "https://x/v.mp4", prompt: "fondo de playa" })!;
  assert.equal(a.endpoint, "fal-ai/kling-video/o1/video-to-video/edit");
  assert.equal(a.body.keep_audio, true);
  assert.equal("image_urls" in a.body, false);
  const b = toolRequest("editar-video", { video: "https://x/v.mp4", prompt: "foto 1", images: ["a", "b", "c", "d", "e"] })!;
  assert.deepEqual(b.body.image_urls, ["a", "b", "c", "d"]);
  const t = findTool("editar-video")!;
  assert.equal(t.consent, true);
  assert.equal(t.estimate(5), 0.84);
});
