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
  assert.match(r.subject, /créditos en tu cuenta/);
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
  assert.ok(none.html.includes("No quiero recibir más consejos") && none.html.includes("US$25 al mes") && none.html.includes("regalo"));
  assert.match(activationEmail("a@x.cl", null, { step: 3, hasPlan: true, ads: 2, unsub: link }).subject, /3 formas/);
  assert.ok(!activationEmail("a@x.cl", null, { step: 1, hasPlan: true, ads: 0, unsub: link }).html.includes("US$19,99"));
});

test("owner report: exact money block (sales, IVA, Mercado Pago, each provider, result, month)", async () => {
  const { ownerReportEmail } = await import("../src/lib/emails");
  const money = {
    day: "2026-10-22",
    ventas: { count: 2, clp: 104_500, usd: 110, iva: 17.56, mp: 4.5, mpReal: true, neto: 87.94 },
    gastos: {
      fal: { usd: 9.8, real: true }, claude: { usd: 1.2, real: true }, google: { usd: 0.3, real: false, note: "estimado por imagen" },
      eleven: { usd: 0, real: true }, oficina: { usd: null, real: false, note: "incluido en Claude" }, meta: { usd: 25, real: true }, fijos: { usd: 5, real: false, note: "costos fijos ÷ 30" },
    },
    gastoTotal: 41.3, resultado: 46.64,
  };
  const e = ownerReportEmail("o@x.cl", { day: "2026-10-22", salesCount: 2, salesUsd: 110, salesClp: 104_500, signups: 1, aiUsd: 11, expired: 0, ending: 0, alerts: [], money, month: { from: "2026-10-22", vendido: 110, neto: 87.94, gastado: 41.3, resultado: 46.64, dias: 1 } });
  for (const t of ["Vendido", "IVA", "Mercado Pago", "fal.ai", "Claude", "Campañas en Meta", "Resultado del día", "gastado US$41,30"]) assert.ok(e.text.includes(t) || e.subject.includes(t), t);
  assert.ok(!e.text.includes("Oficina de agentes"), "office line hidden when it's inside Claude's real cost");
});

test("ownerSaleEmail: says new sale vs renewal, with amount and customer", async () => {
  const { ownerSaleEmail } = await import("../src/lib/emails");
  const e = ownerSaleEmail("o@x.com", { label: "Plan Negocio · mensual", amount: 94000, currency: "CLP", customer: "c@x.com", account: "Café", renewal: false, orderId: "p1" });
  assert.match(e.subject, /Nueva venta: Plan Negocio · mensual · \$94\.000/);
  assert.match(e.text, /c@x\.com/);
  assert.match(ownerSaleEmail("o@x.com", { label: "x", amount: 1, currency: "CLP", customer: "", account: "", renewal: true, orderId: "p" }).subject, /Renovación/);
});
