import { createHmac, timingSafeEqual } from "node:crypto";

// Mercado Pago (Chile): one-time payments with Checkout Pro (yearly plans and credit top-ups) and
// monthly subscriptions (preapproval). The customer pays on Mercado Pago's own page; we never see
// card data. Server-only. Needs MP_ACCESS_TOKEN in Vercel (a TEST- token works in test mode).

const API = "https://api.mercadopago.com";
export const SITE = process.env.SITE_URL || "https://www.creadsia.com";

export const mpReady = () => Boolean(process.env.MP_ACCESS_TOKEN);
/**
 * MP_ONE_TIME=1: monthly plans are charged once (one month, no automatic renewal). Used while selling
 * from a temporary Mercado Pago account: subscriptions would keep charging that account after the switch.
 */
export const oneTimeOnly = () => process.env.MP_ONE_TIME === "1";
const testMode = () => (process.env.MP_ACCESS_TOKEN ?? "").startsWith("TEST-");

async function mp<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new Error("Mercado Pago no está conectado.");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`Mercado Pago: ${body?.message ?? res.statusText} (${res.status})`);
  return body as T;
}

const back = (orderId: string) => `${SITE}/app/planes?pago=volver&pedido=${encodeURIComponent(orderId)}`;

/** One-time payment page (Checkout Pro). Returns the link to send the customer to. */
export async function createPreference(o: { orderId: string; title: string; clp: number; email: string }) {
  const r = await mp<{ id: string; init_point: string; sandbox_init_point?: string }>("/checkout/preferences", {
    method: "POST",
    headers: { "x-idempotency-key": `pref-${o.orderId}` },
    body: JSON.stringify({
      items: [{ id: o.orderId, title: o.title, quantity: 1, unit_price: o.clp, currency_id: "CLP" }],
      payer: { email: o.email },
      external_reference: o.orderId,
      notification_url: `${SITE}/api/pagos/mp`,
      back_urls: { success: back(o.orderId), pending: back(o.orderId), failure: back(o.orderId) },
      auto_return: "approved",
      statement_descriptor: "CREADS IA",
    }),
  });
  return { id: r.id, url: testMode() && r.sandbox_init_point ? r.sandbox_init_point : r.init_point };
}

/**
 * Monthly subscription: Mercado Pago charges the card every month. `firstClp` can be lower than the
 * regular price (launch offer); after the first payment the amount is raised to `clp`.
 */
export async function createSubscription(o: { orderId: string; title: string; firstClp: number; email: string }) {
  const r = await mp<{ id: string; init_point: string; sandbox_init_point?: string }>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: o.title,
      external_reference: o.orderId,
      payer_email: o.email,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: o.firstClp, currency_id: "CLP" },
      back_url: back(o.orderId),
      status: "pending",
    }),
  });
  return { id: r.id, url: testMode() && r.sandbox_init_point ? r.sandbox_init_point : r.init_point };
}

export interface MpPayment { id: number; status: string; transaction_amount: number; currency_id: string; external_reference?: string | null; metadata?: Record<string, unknown>; payer?: { email?: string } }
export const getPayment = (id: string) => mp<MpPayment>(`/v1/payments/${encodeURIComponent(id)}`);

export interface MpPreapproval { id: string; status: string; external_reference?: string | null; payer_email?: string; auto_recurring?: { transaction_amount?: number } }
export const getPreapproval = (id: string) => mp<MpPreapproval>(`/preapproval/${encodeURIComponent(id)}`);

export interface MpAuthorizedPayment { id: number | string; preapproval_id: string; status: string; transaction_amount?: number; payment?: { id: number | string; status: string } }
export const getAuthorizedPayment = (id: string) => mp<MpAuthorizedPayment>(`/authorized_payments/${encodeURIComponent(id)}`);

/** Approved charges of a subscription, by asking Mercado Pago (two ways, in case one isn't available). */
export async function subscriptionPaymentIds(preapprovalId: string, orderId: string): Promise<string[]> {
  const ids = new Set<string>();
  try {
    const r = await mp<{ results?: { payment?: { id?: number | string; status?: string } }[] }>(`/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}`);
    for (const x of r.results ?? []) if (x.payment?.id && x.payment.status === "approved") ids.add(String(x.payment.id));
  } catch (e) { console.warn("authorized_payments search", preapprovalId, e instanceof Error ? e.message : e); }
  try {
    const r = await mp<{ results?: { id: number; status: string }[] }>(`/v1/payments/search?external_reference=${encodeURIComponent(orderId)}&sort=date_created&criteria=desc&limit=20`);
    for (const x of r.results ?? []) if (x.status === "approved") ids.add(String(x.id));
  } catch (e) { console.warn("payments search", orderId, e instanceof Error ? e.message : e); }
  return [...ids];
}

export const setSubscriptionAmount = (id: string, clp: number) =>
  mp(`/preapproval/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ auto_recurring: { transaction_amount: clp, currency_id: "CLP" } }) });

export const cancelSubscription = (id: string) =>
  mp(`/preapproval/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ status: "cancelled" }) });

/**
 * Checks Mercado Pago's signature on a notification (x-signature: "ts=…,v1=…"). We never trust a
 * notification's content anyway (every payment is read back from Mercado Pago with our token), so a
 * failed check is logged, not fatal.
 */
export function signatureOk(req: Request, dataId: string) {
  const secret = process.env.MP_WEBHOOK_SECRET;
  const sig = req.headers.get("x-signature") ?? "";
  if (!secret || !sig) return null;
  const parts = Object.fromEntries(sig.split(",").map((p) => p.trim().split("=") as [string, string]));
  const manifest = `id:${dataId.toLowerCase()};request-id:${req.headers.get("x-request-id") ?? ""};ts:${parts.ts ?? ""};`;
  const want = createHmac("sha256", secret).update(manifest).digest("hex");
  const got = parts.v1 ?? "";
  return got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
