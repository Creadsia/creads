import { test } from "node:test";
import assert from "node:assert/strict";
import { sizeFor } from "../src/lib/providers/openai-image";
import { serviceOfModel } from "../src/lib/balances";

test("gpt image: sizes and crops for each ad format; billed to OpenAI", () => {
  assert.deepEqual(sizeFor("1:1"), { size: "1024x1024", crop: null });
  assert.deepEqual(sizeFor("9:16"), { size: "1024x1536", crop: "crop=864:1536" });
  assert.deepEqual(sizeFor("4:5"), { size: "1024x1536", crop: "crop=1024:1280" });
  assert.deepEqual(sizeFor("16:9"), { size: "1536x1024", crop: "crop=1536:864" });
  assert.equal(serviceOfModel("gpt-image-2.5"), "openai");
  assert.equal(serviceOfModel("nano-banana-pro"), "google");
});
