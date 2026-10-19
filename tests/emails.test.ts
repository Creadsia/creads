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

test("owner daily summary", async () => {
  const { ownerReportEmail } = await import("../src/lib/emails");
  const e = ownerReportEmail("o@x.cl", { day: "2026-10-16", salesCount: 2, salesUsd: 59, salesClp: 55990, signups: 3, aiUsd: 12.5, expired: 0, ending: 1, alerts: ["fal.ai: saldo bajo"] });
  assert.match(e.subject, /2 ventas, US\$59,00 · ⚠ revisar/);
  assert.ok(e.html.includes("US$46,50") && e.text.includes("fal.ai: saldo bajo"));
});

test("activation tips carry an opt-out and adapt to the customer", async () => {
  const { activationEmail } = await import("../src/lib/emails");
  const { unsubLink, unsubOk } = await import("../src/lib/unsub");
  const link = unsubLink("https://x.cl", "Ana@x.cl");
  const t = new URL(link).searchParams.get("t")!;
  assert.ok(unsubOk("ana@x.cl", t) && !unsubOk("otra@x.cl", t));
  const none = activationEmail("a@x.cl", "Ana", { step: 3, hasPlan: false, ads: 0, unsub: link });
  assert.match(none.subject, /Te ayudo/);
  assert.ok(none.html.includes("No quiero recibir más consejos") && none.html.includes("US$49 el primer mes"));
  assert.match(activationEmail("a@x.cl", null, { step: 3, hasPlan: true, ads: 2, unsub: link }).subject, /3 formas/);
  assert.ok(!activationEmail("a@x.cl", null, { step: 1, hasPlan: true, ads: 0, unsub: link }).html.includes("US$49"));
});
