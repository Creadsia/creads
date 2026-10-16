// Money checks: which service pays for what, refusing a job before spending when a service is dry,
// and never telling customers about Creadsia's balances.
// Run: npx tsx --test tests/balances.test.ts
import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";
import { CUSTOMER_UNAVAILABLE, NoFundsError, ensureFunds, explainFailure, falBalance, outOfFundsService, serviceOf, serviceOfModel } from "../src/lib/balances";

const realFetch = globalThis.fetch;
const env = { ...process.env };
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

/** Fakes fal's billing answer (and lets storage writes "succeed"). */
function fakeFal(balance: number | "forbidden") {
  process.env.FAL_KEY = "test";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("api.fal.ai/v1/account/billing")) {
      return balance === "forbidden" ? new Response("{}", { status: 403 }) : Response.json({ username: "x", credits: { current_balance: balance, currency: "USD" } });
    }
    return new Response("{}", { status: 404 });
  }) as typeof fetch;
}

describe("which service pays", () => {
  test("models and tools map to the right account", () => {
    assert.equal(serviceOfModel("veo-3.1-fast"), "google");
    assert.equal(serviceOfModel("nano-banana-pro"), "google");
    assert.equal(serviceOf("gen:image", "Nano Banana Pro"), "google");
    assert.equal(serviceOfModel("nano-banana-2"), "fal");
    assert.equal(serviceOfModel("seedance-2.5"), "fal");
    assert.equal(serviceOf("tool:musica", "ElevenLabs"), "eleven");
    assert.equal(serviceOf("tool:quitar-fondo", "Bria"), "fal");
  });
});

describe("check before spending", () => {
  test("refuses a fal job the balance can't cover", async () => {
    fakeFal(1.2);
    await falBalance(true);
    await assert.rejects(ensureFunds("fal", 1), NoFundsError);
  });

  test("lets it through with enough balance, and counts what it just spent", async () => {
    fakeFal(3);
    await falBalance(true);
    await ensureFunds("fal", 1.5); // 3 → 1.5 left
    await assert.rejects(ensureFunds("fal", 1.5), NoFundsError); // 1.5 < 1.5 + margin
  });

  test("never blocks when the balance can't be read", async () => {
    fakeFal("forbidden");
    await falBalance(true);
    await ensureFunds("fal", 50);
  });
});

describe("what people are told", () => {
  test("recognises each service's 'no money' answer", () => {
    assert.equal(outOfFundsService(new Error("fal: User is locked. Reason: Exhausted balance. (código 403)")), "fal");
    assert.equal(outOfFundsService(new Error("ElevenLabs: quota_exceeded")), "eleven");
    assert.equal(outOfFundsService(new Error("Your credit balance is too low to access the Anthropic API")), "claude");
    assert.equal(outOfFundsService(new Error("Prompt rechazado por seguridad")), null);
  });

  test("customers get a calm message; only the owner hears about balances", async () => {
    const err = new Error("User is locked. Reason: Exhausted balance.");
    const customer = await explainFailure(err, false, "fal");
    const owner = await explainFailure(err, true, "fal");
    assert.equal(customer, CUSTOMER_UNAVAILABLE);
    assert.doesNotMatch(customer, /saldo|fal|US\$/i);
    assert.match(owner, /fal\.ai se quedó sin saldo/);
  });

  test("other errors pass through unchanged", async () => {
    assert.equal(await explainFailure(new Error("Describe la escena."), false), "Describe la escena.");
  });
});
