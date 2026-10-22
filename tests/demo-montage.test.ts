import { test } from "node:test";
import assert from "node:assert/strict";
import { planDemo } from "../src/lib/demo-montage";

test("demo plan: opens on a clip, then the card, ends on the presenter, covers the whole video without gaps", () => {
  const s = planDemo(40, 4, true);
  assert.equal(s[0].kind, "split");
  assert.equal(s[1].kind, "card");
  assert.equal(s[s.length - 1].kind, "host");
  assert.equal(s[0].a, 0);
  assert.equal(s[s.length - 1].b, 40);
  for (let i = 1; i < s.length; i++) assert.ok(Math.abs(s[i].a - s[i - 1].b) < 0.002, `gap at ${i}`);
  const used = new Set(s.filter((x) => x.ex !== undefined).map((x) => x.ex));
  assert.equal(used.size, 4, "every example appears");
});

test("demo plan: too short or no examples → only the presenter", () => {
  assert.deepEqual(planDemo(5, 3, true).map((x) => x.kind), ["host"]);
  assert.deepEqual(planDemo(30, 0, true).map((x) => x.kind), ["host"]);
});
