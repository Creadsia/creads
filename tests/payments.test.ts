// Prices in pesos and Mercado Pago's notification signature.
// Run: npx tsx --test tests/payments.test.ts
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { clpFor, quote } from "../src/lib/catalog";
import { signatureOk } from "../src/lib/mercadopago";

test("peso prices end in 990 and follow the dollar rate", () => {
  assert.equal(clpFor(59, 950), 55990);
  assert.equal(clpFor(29.5, 950), 27990);
  assert.equal(clpFor(129, 950), 122990);
  assert.equal(clpFor(0.5, 950), 990);
});

test("quotes: launch offer only on the first monthly payment, customer discount on top", () => {
  const first = quote("starter", "mensual", { firstPurchase: true })!;
  assert.equal(first.total, 59, "Starter: US$59 the first month (then US$79)");
  assert.equal(quote("plus", "mensual", { firstPurchase: true })!.launch, 0, "only Starter has the launch offer");
  const later = quote("starter", "mensual", { firstPurchase: false, discountPct: 10 })!;
  assert.equal(later.total, 71.1);
  assert.equal(quote("starter", "anual", { firstPurchase: true })!.launch, 0);
  assert.equal(quote("nope" as never, "mensual"), null);
});

test("Mercado Pago signature: valid passes, tampered fails, no secret = not checked", () => {
  process.env.MP_WEBHOOK_SECRET = "secreto";
  const ts = "1700000000";
  const v1 = createHmac("sha256", "secreto").update(`id:123;request-id:req-1;ts:${ts};`).digest("hex");
  const req = (sig: string) => new Request("https://x/api/pagos/mp", { headers: { "x-signature": sig, "x-request-id": "req-1" } });
  assert.equal(signatureOk(req(`ts=${ts},v1=${v1}`), "123"), true);
  assert.equal(signatureOk(req(`ts=${ts},v1=${"0".repeat(64)}`), "123"), false);
  delete process.env.MP_WEBHOOK_SECRET;
  assert.equal(signatureOk(req(`ts=${ts},v1=${v1}`), "123"), null);
});
