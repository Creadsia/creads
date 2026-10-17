import { test } from "node:test";
import assert from "node:assert/strict";
import { makeResetToken, readResetToken, resetTokenOk } from "../src/lib/reset-token";
import { welcomeEmail, receiptEmail, resetEmail, planEndingEmail } from "../src/lib/emails";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-secret-key"; // read when signing, not at import

test("reset link: works with the current password, not after it changes, not after an hour", () => {
  const tok = makeResetToken("ana@x.cl", "hash-1");
  const t = readResetToken(tok)!;
  assert.equal(t.email, "ana@x.cl");
  assert.ok(resetTokenOk(t, "hash-1"));
  assert.ok(!resetTokenOk(t, "hash-2"));
  assert.equal(readResetToken(tok, Date.now() + 61 * 60_000), null);
  assert.equal(readResetToken("garbage"), null);
  const forged = Buffer.from("otro@x.cl\n" + t.exp).toString("base64url") + "." + tok.split(".")[1];
  const f = readResetToken(forged)!;
  assert.ok(!resetTokenOk(f, "hash-1"));
});

test("emails escape names and include a text version", () => {
  const w = welcomeEmail("a@x.cl", "<script>Ana</script> Pérez");
  assert.ok(!w.html.includes("<script>"));
  const r = receiptEmail("a@x.cl", { label: "Plan Starter · mensual", credits: 1000, amount: 55990, currency: "CLP", orderId: "C-1", paymentId: "123" });
  assert.match(r.subject, /1\.000 créditos/);
  assert.ok(r.html.includes("$55.990"));
  assert.ok(resetEmail("a@x.cl", null, "https://x/clave?t=1").html.includes("https://x/clave?t=1"));
  assert.match(planEndingEmail("a@x.cl", "Ana", { plan: "Starter", until: "2026-10-19", daysLeft: 3, credits: 200 }).subject, /vence en 3 días/);
  assert.match(planEndingEmail("a@x.cl", "Ana", { plan: "Starter", until: "2026-10-16", daysLeft: 0, credits: 0 }).subject, /vence hoy/);
});
