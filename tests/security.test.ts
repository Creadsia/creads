// Two-step codes match the standard (RFC 6238), and credit prices follow the owner's settings.
// Run: npx tsx --test tests/security.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { creditsFor } from "../src/lib/credit-math";
import { codeAt, newSecret, verifyCode } from "../src/lib/totp";

const RFC = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"; // "12345678901234567890"

test("codes match the RFC 6238 test vectors", () => {
  assert.equal(codeAt(RFC, 59_000), "287082");
  assert.equal(codeAt(RFC, 1_111_111_109_000), "081804");
  assert.equal(codeAt(RFC, 2_000_000_000_000), "279037");
});

test("accepts the current code and one step of drift, nothing else", () => {
  const s = newSecret();
  const now = 1_700_000_000_000;
  assert.equal(verifyCode(s, codeAt(s, now), now), true);
  assert.equal(verifyCode(s, codeAt(s, now - 30_000), now), true);
  assert.equal(verifyCode(s, codeAt(s, now - 90_000), now), false);
  assert.equal(verifyCode(s, "12345", now), false);
  assert.equal(verifyCode(s, "", now), false);
});

test("credit prices: cost / rate, rounded up, discount applied, never free by accident", () => {
  assert.equal(creditsFor(0.1, 0.02), 5);
  assert.equal(creditsFor(0.101, 0.02), 6);
  assert.equal(creditsFor(0.001, 0.02), 1); // anything paid costs at least 1
  assert.equal(creditsFor(1, 0.02, 50), 25);
  assert.equal(creditsFor(1, 0.02, 100), 0); // the owner chose to make it free
  assert.equal(creditsFor(0, 0.02), 0);
  assert.equal(creditsFor(1, 0), creditsFor(1)); // bad rate falls back to the default
});
