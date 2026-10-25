import { test } from "node:test";
import assert from "node:assert/strict";
import { PLANS, PLAN_VERSION, quote } from "../src/lib/catalog";
import { orderGrant } from "../src/lib/settle";
import type { Order } from "../src/lib/billing";

// plan_version (owner's plan, 25 Oct 2026): a subscriber keeps the monthly balance of the version they bought.

const order = (q: NonNullable<ReturnType<typeof quote>>): Order => ({
  id: "o1", ws: "w", wsName: "w", email: "a@b.c", item: q.item, period: q.period, method: "mercadopago", quote: q, status: "pagado", created: new Date().toISOString(),
});

test("a plan quote records the plan version and the monthly credits", () => {
  const q = quote("escala", "mensual")!;
  assert.equal(q.planVersion, PLAN_VERSION);
  assert.equal(q.monthlyCredits, PLANS.find((p) => p.id === "escala")!.credits);
});

test("Agencia now gives 4.000 credits a month", () => {
  assert.equal(PLANS.find((p) => p.id === "agencia")!.credits, 4000);
});

test("a renewal gives the credits promised in the order, not the current catalog", () => {
  const q = { ...quote("escala", "mensual")!, monthlyCredits: 800 };
  assert.equal(orderGrant(order(q)).credits, 800);
  const yearly = { ...quote("escala", "anual")!, monthlyCredits: 800 };
  assert.equal(orderGrant(order(yearly)).credits, 800 * 12);
});

test("older orders without the field fall back to the catalog", () => {
  const q = quote("testea", "mensual")!;
  delete (q as { monthlyCredits?: number }).monthlyCredits;
  assert.equal(orderGrant(order(q)).credits, PLANS.find((p) => p.id === "testea")!.credits);
});
