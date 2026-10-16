// Long scene prompts must fit each model's limit without losing a single spoken word.
// Run: npx tsx --test tests/fit-prompt.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { fitPrompt, promptLimitFrom, trimPrompt } from "../src/lib/fit-prompt";

const line = "We got three quotes before repairing our foundation, and honestly the price differences were insane.";
const lessons = Array.from({ length: 10 }, (_, i) => `- Lesson number ${i + 1}: ${"keep the same shirt and the same kitchen in every cut. ".repeat(3)}`).join("\n");
const long = `SPOKEN LINE (the ONLY words in this video): "${line}"

Vertical 9:16 UGC selfie video. ${"Real phone footage, natural light. ".repeat(20)}
LESSONS FROM PAST VIDEOS (avoid these mistakes):
${lessons}
Reminder: the person says ONLY: "${line}"`;

test("cheap cuts drop repeats and extra lessons first, keeping the dialogue", () => {
  assert.ok(long.length > 2500);
  const s = trimPrompt(long, 2500);
  assert.ok(s.length <= 2500, `still ${s.length}`);
  assert.ok(s.includes(`"${line}"`));
  assert.ok(!/Reminder:/.test(s));
});

test("fitPrompt always fits, even without Claude", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  const huge = long + "\n" + "Extra direction. ".repeat(400);
  const s = await fitPrompt(huge, 2500);
  assert.ok(s.length <= 2500);
  assert.ok(s.includes(line));
  assert.equal(await fitPrompt("short", 2500), "short");
});

test("reads the limit out of the model's refusal", () => {
  assert.equal(promptLimitFrom("Kling 3.0 Pro: String should have at most 2500 characters (código 422)"), 2500);
  assert.equal(promptLimitFrom("something else"), null);
});
