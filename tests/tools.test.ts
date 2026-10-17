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

test("copy motion: character follows the video, keeps its sound, priced per second", () => {
  const a = toolRequest("copiar-movimiento", { image: "https://x/p.png", video: "https://x/v.mp4" })!;
  assert.equal(a.endpoint, "fal-ai/kling-video/v3/standard/motion-control");
  assert.equal(a.body.character_orientation, "video");
  assert.equal(a.body.keep_original_sound, true);
  assert.equal("prompt" in a.body, false);
  assert.equal(toolRequest("copiar-movimiento", { image: "i", video: "v", prompt: "en una cocina" })!.body.prompt, "en una cocina");
  const t = findTool("copiar-movimiento")!;
  assert.equal(t.consent, true);
  assert.equal(t.inputs.video?.max, 30);
  assert.equal(t.estimate(10), 1.26);
  assert.equal(t.estimate(1), 0.38); // 3 s minimum
});

test("inspiration: owner input is clamped and the tool is one of the two recreate modes", async () => {
  const { cleanExample } = await import("../src/lib/inspiracion");
  const e = cleanExample({ title: "  Hola  ", prompt: "x".repeat(900), mode: "quitar-fondo", tag: 5 });
  assert.equal(e.title, "Hola");
  assert.equal(e.prompt.length, 600);
  assert.equal(e.mode, "editar-video");
  assert.equal(e.tag, "");
});
