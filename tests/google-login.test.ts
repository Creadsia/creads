import { test } from "node:test";
import assert from "node:assert/strict";
import { readIdToken, safeNext } from "../src/lib/google-login";

const tok = (p: Record<string, unknown>) => `x.${Buffer.from(JSON.stringify(p)).toString("base64url")}.y`;

test("google login: id token checks and safe redirects", () => {
  const now = Date.parse("2026-10-23T02:00:00Z");
  const good = { aud: "cid", iss: "https://accounts.google.com", exp: now / 1000 + 600, email: "Ana@Gmail.com", email_verified: true, sub: "123", name: "Ana" };
  assert.deepEqual(readIdToken(tok(good), "cid", now), { email: "ana@gmail.com", name: "Ana", sub: "123" });
  assert.equal(readIdToken(tok({ ...good, aud: "otro" }), "cid", now), null);
  assert.equal(readIdToken(tok({ ...good, email_verified: false }), "cid", now), null);
  assert.equal(readIdToken(tok({ ...good, exp: now / 1000 - 3600 }), "cid", now), null);
  assert.equal(safeNext("/app/planes?plan=plus&periodo=mensual"), "/app/planes?plan=plus&periodo=mensual");
  assert.equal(safeNext("//evil.com"), "/app");
  assert.equal(safeNext("https://evil.com"), "/app");
});
