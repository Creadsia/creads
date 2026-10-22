import { test } from "node:test";
import assert from "node:assert/strict";
import { adScore } from "../src/lib/voices";

const v = (o: Record<string, unknown>) => ({ ref: "lib:a:b", id: "b", owner: "a", name: "x", gender: "female", age: "young", accent: "es-AR", ...o });

test("adScore: young ad/social voices rank above old audiobook narrators", () => {
  assert.ok(adScore(v({ useCase: "social_media", descriptive: "upbeat", clones: 500 })) > adScore(v({ age: "old", useCase: "narrative_story", descriptive: "deep", clones: 500 })));
});
test("adScore: popularity still counts", () => {
  assert.ok(adScore(v({ clones: 10000 })) > adScore(v({ clones: 2 })));
});
