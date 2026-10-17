import { test } from "node:test";
import assert from "node:assert/strict";
import { REFUSED, SLOW, UNAVAILABLE, customerText } from "../src/lib/public-error";

test("customers never see providers, keys or balances", () => {
  assert.equal(customerText("fal.ai: User is locked. Reason: Exhausted balance. Top up your balance at fal.ai/dashboard/billing."), UNAVAILABLE);
  assert.equal(customerText("ElevenLabs: quota_exceeded"), UNAVAILABLE);
  assert.equal(customerText("Your credit balance is too low to access the Anthropic API"), UNAVAILABLE);
  assert.equal(customerText("Content flagged by safety system"), REFUSED);
  assert.equal(customerText("Request timed out after 60s"), SLOW);
  const k = customerText("Falta FAL_KEY en Vercel.", "No se pudo generar.");
  assert.ok(!/FAL|Vercel/.test(k) && k.startsWith("No se pudo generar. Vuelve a intentarlo"));
  assert.ok(!/claude|422/i.test(customerText("Claude respondió 422 Unprocessable", "No se pudo escribir.")));
});

test("our own Spanish messages pass through", () => {
  for (const m of ["Primero crea la imagen de esta toma.", "Te quedaste sin créditos.", "Este corte ya se está generando.", "Kling 3.0 no genera voz. Elige Seedance o Veo.", "Cuesta 500 créditos."]) assert.equal(customerText(m), m);
});
