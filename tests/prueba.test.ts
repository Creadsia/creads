import { test } from "node:test";
import assert from "node:assert/strict";
import { bloqueaPorTarjeta, darRegalo, modoPack, PRUEBA_PLAN, REGALO_CREDITS, tarjetaObligatoria } from "../src/lib/regalo";
import { planPrueba, resumenPrueba } from "../src/lib/prueba";
import { onSale, quote } from "../src/lib/catalog";
import { orderGrant } from "../src/lib/settle";
import { welcomeEmail, trialEndingEmail } from "../src/lib/emails";

/** Runs `fn` with these env values, then puts the old ones back. */
async function withEnv(env: Record<string, string | undefined>, fn: () => unknown) {
  const before = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  try { await fn(); } finally {
    for (const [k, v] of Object.entries(before)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}

test("card trial is the default since 26 Oct 2026: the Pack Prueba only with MODO_PACK=1", async () => {
  await withEnv({ MODO_PACK: undefined, REGALO_CON_TARJETA: undefined }, async () => {
    assert.equal(modoPack(), false);
    assert.equal(tarjetaObligatoria(), true);
    // without a card the gift is not given (checked before anything else)
    assert.deepEqual(await darRegalo("ws-test", "ana@example.com"), { ok: false, why: "tarjeta" });
  });
  await withEnv({ MODO_PACK: "0", REGALO_CON_TARJETA: undefined }, () => {
    assert.equal(modoPack(), false);
    assert.equal(tarjetaObligatoria(), true);
  });
  await withEnv({ MODO_PACK: "1", REGALO_CON_TARJETA: undefined }, async () => {
    assert.equal(modoPack(), true);
    assert.equal(tarjetaObligatoria(), false);
    assert.deepEqual(await darRegalo("ws-test", "ana@example.com"), { ok: false, why: "pack" });
  });
  await withEnv({ MODO_PACK: undefined, REGALO_CON_TARJETA: "0" }, () => {
    assert.equal(modoPack(), false);
    assert.equal(tarjetaObligatoria(), false);
  });
});

test("the trial becomes Testea: its real price and its monthly credits", () => {
  assert.equal(PRUEBA_PLAN, "testea");
  assert.ok(onSale(PRUEBA_PLAN, "mensual"));
  const p = planPrueba();
  assert.deepEqual(p, { id: "testea", name: "Testea", usd: 29, credits: 470 });
  assert.deepEqual(resumenPrueba(), { dias: 7, regalo: REGALO_CREDITS, plan: "Testea", usd: 29, credits: 470 });
  // the order of the trial (same quote as empezarPrueba): Testea's price, and each charge gives Testea's credits
  const q = quote(PRUEBA_PLAN, "mensual", { firstPurchase: false })!;
  assert.equal(q.total, 29);
  assert.equal(q.monthlyCredits, 470);
  assert.match(q.label, /Testea/);
  assert.deepEqual(orderGrant({ item: PRUEBA_PLAN, period: "mensual", quote: q } as never), { credits: 470, months: 1, plan: "Testea" });
  // a trial started before 26 Oct 2026 (Básico) keeps what it was sold
  const old = quote("basico", "mensual", { firstPurchase: false })!;
  assert.deepEqual(orderGrant({ item: "basico", period: "mensual", quote: old } as never), { credits: 500, months: 1, plan: "Básico" });
});

test("lock rule: who has to add the card before using the studio", () => {
  const base = { trialOn: true, unlimited: false, paid: false, giftGiven: false };
  // a new account (email or Google: same rule), or one created since 25 Oct with no card and no payment
  assert.equal(bloqueaPorTarjeta(base), true);
  // already paid (plan, top-up, Pack Prueba, credits added by the owner)
  assert.equal(bloqueaPorTarjeta({ ...base, paid: true }), false);
  // already got its gift (the card was added, or the gift came before the card trial)
  assert.equal(bloqueaPorTarjeta({ ...base, giftGiven: true }), false);
  // the owner's own account («main», unlimited)
  assert.equal(bloqueaPorTarjeta({ ...base, unlimited: true }), false);
  // card trial off (MODO_PACK=1, REGALO_CON_TARJETA=0, or Mercado Pago not set up)
  assert.equal(bloqueaPorTarjeta({ ...base, trialOn: false }), false);
});

test("emails: the trial says Testea, its price in dollars and its credits", async () => {
  await withEnv({ MODO_PACK: undefined }, () => {
    const w = welcomeEmail("a@x.cl", "Ana", null, false, resumenPrueba());
    assert.match(w.subject, /prueba gratis de 7 días/);
    assert.ok(w.html.includes("Testea") && w.html.includes("US$29 al mes") && w.html.includes("200 créditos de regalo"));
    assert.ok(!w.html.includes("Básico") && !w.html.includes("US$9"));
  });
  await withEnv({ MODO_PACK: "1" }, () => {
    assert.match(welcomeEmail("a@x.cl", "Ana").html, /Pack Prueba de US\$9/);
  });
  const e = trialEndingEmail("a@x.cl", null, { fecha: "2 de noviembre", plan: "Testea", usd: 29, clp: 27990, credits: 470, ads: 1 });
  assert.ok(e.html.includes("US$29 al mes") && e.html.includes("470 créditos") && e.html.includes("$27.990"));
  assert.ok(!e.html.includes("500 créditos"));
});
