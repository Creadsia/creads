// A subscription charge whose notification was missed is found at Mercado Pago and applied once.
import assert from "node:assert/strict";
import { test } from "node:test";

process.env.SUPABASE_URL = "https://proj.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "svc";
process.env.MP_ACCESS_TOKEN = "APP_USR-x";

import { reconcileSubscription } from "../src/lib/settle";

test("missed notice: the approved charge is looked up and applied with its own payment id (once)", async () => {
  let payments: string[] = [];
  const rpc: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    const m = init?.method ?? "GET";
    if (url.includes("/rest/v1/orders")) return new Response(JSON.stringify([{ id: "CR-F4422837", owner: "barbara-1", ws_name: "Bárbara", email: "b@x.cl", item: "starter", period: "mensual", method: "mercadopago", quote: { item: "starter", label: "Plan Starter · mensual", credits: 1000, subtotal: 119, launch: 89.25, discount: 0, total: 29.75, period: "mensual" }, status: "pendiente", payments, mp: { kind: "subscription", id: "pre-9", clp: 27990, fullClp: 112990 }, visitor: null, created_at: new Date().toISOString(), closed_at: null }]));
    if (url.includes("/authorized_payments/search")) return new Response(JSON.stringify({ results: [{ payment: { id: 555, status: "approved" } }] }));
    if (url.includes("/v1/payments/search")) return new Response(JSON.stringify({ results: [] }));
    if (url.includes("/v1/payments/555")) return new Response(JSON.stringify({ id: 555, status: "approved", transaction_amount: 27990, currency_id: "CLP" }));
    if (url.includes("/rpc/apply_payment")) { const b = JSON.parse(String(init!.body)); rpc.push(b); payments = [...payments, b.p_payment]; return new Response(JSON.stringify("applied")); }
    if (url.includes("/preapproval/pre-9")) return new Response(JSON.stringify({ id: "pre-9", status: "authorized", auto_recurring: { transaction_amount: m === "PUT" ? 112990 : 27990 } }));
    return new Response("[]");
  }) as typeof fetch;
  assert.equal(await reconcileSubscription("CR-F4422837"), 1);
  assert.equal(rpc[0].p_payment, "mp:555");
  assert.equal(rpc[0].p_credits, 1500, "Emprende gives 1,500 credits a month (≈ 131 s of video)");
  assert.equal(rpc[0].p_months, 1);
  assert.equal(await reconcileSubscription("CR-F4422837"), 0, "already applied: nothing again");
});
