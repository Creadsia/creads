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
export async function createPreference(o: { orderId: string; title: string; clp: number; email: string; /** a studio page to come back to (e.g. the batch being made) */ backPath?: string }) {
  const ret = o.backPath ? `${SITE}${o.backPath}${o.backPath.includes("?") ? "&" : "?"}pago=volver&pedido=${encodeURIComponent(o.orderId)}` : back(o.orderId);
  const r = await mp<{ id: string; init_point: string; sandbox_init_point?: string }>("/checkout/preferences", {
    method: "POST",
    headers: { "x-idempotency-key": `pref-${o.orderId}` },
    body: JSON.stringify({
      items: [{ id: o.orderId, title: o.title, quantity: 1, unit_price: o.clp, currency_id: "CLP" }],
      payer: { email: o.email },
      external_reference: o.orderId,
      notification_url: `${SITE}/api/pagos/mp`,
      back_urls: { success: ret, pending: ret, failure: ret },
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
export async function createSubscription(o: { orderId: string; title: string; firstClp: number; email: string; /** free trial: first charge on this day (ISO) */ startDate?: string; backUrl?: string }) {
  const r = await mp<{ id: string; init_point: string; sandbox_init_point?: string }>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: o.title,
      external_reference: o.orderId,
      payer_email: o.email,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: o.firstClp, currency_id: "CLP", ...(o.startDate ? { start_date: o.startDate } : {}) },
      back_url: o.backUrl ?? back(o.orderId),
      status: "pending",
    }),
  });
  return { id: r.id, url: testMode() && r.sandbox_init_point ? r.sandbox_init_point : r.init_point };
}

/**
 * The same monthly subscription, but with the card the customer typed inside Creads (Mercado Pago's own secure
 * card fields give us a one-time token; we never see the card). Authorized right away; the first charge on startDate.
 */
export async function createSubscriptionWithCard(o: { orderId: string; title: string; clp: number; email: string; cardToken: string; startDate: string }) {
  return mp<{ id: string; status: string }>("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: o.title,
      external_reference: o.orderId,
      payer_email: o.email,
      card_token_id: o.cardToken,
      auto_recurring: { frequency: 1, frequency_type: "months", start_date: o.startDate, transaction_amount: o.clp, currency_id: "CLP" },
      back_url: `${SITE}/app/automatico`,
      status: "authorized",
    }),
  });
}

export interface MpPayment { id: number; status: string; transaction_amount: number; currency_id: string; fee_details?: { amount: number; type?: string }[]; transaction_details?: { net_received_amount?: number }; external_reference?: string | null; metadata?: Record<string, unknown>; payer?: { email?: string } }
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

/** Gives a payment's money back to the customer (full refund). Idempotent per payment. */
export const refundPayment = (paymentId: string) =>
  mp<{ id: number; amount?: number; status?: string }>(`/v1/payments/${encodeURIComponent(paymentId)}/refunds`, { method: "POST", headers: { "x-idempotency-key": `refund-${paymentId}` }, body: "{}" });

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

/** Plain-Spanish reasons for Mercado Pago's rejection codes (status_detail). */
const MOTIVOS: Record<string, string> = {
  cc_rejected_insufficient_amount: "Rechazado: la tarjeta no tenía saldo o cupo suficiente.",
  cc_rejected_bad_filled_security_code: "Rechazado: código de seguridad mal ingresado.",
  cc_rejected_bad_filled_date: "Rechazado: fecha de vencimiento mal ingresada.",
  cc_rejected_bad_filled_card_number: "Rechazado: número de tarjeta mal ingresado.",
  cc_rejected_bad_filled_other: "Rechazado: algún dato de la tarjeta mal ingresado.",
  cc_rejected_call_for_authorize: "Rechazado: el banco pide que el cliente autorice el pago llamando.",
  cc_rejected_card_disabled: "Rechazado: la tarjeta no está activada.",
  cc_rejected_duplicated_payment: "Rechazado: pago duplicado.",
  cc_rejected_high_risk: "Rechazado por Mercado Pago por prevención de fraude.",
  cc_rejected_max_attempts: "Rechazado: demasiados intentos con la tarjeta.",
  cc_rejected_blacklist: "Rechazado por Mercado Pago (tarjeta o cuenta bloqueada).",
  cc_rejected_other_reason: "Rechazado por el banco, sin detalle.",
  pending_contingency: "Pendiente: Mercado Pago lo está revisando.",
  pending_review_manual: "Pendiente: en revisión manual de Mercado Pago.",
  pending_waiting_payment: "Pendiente: esperando que el cliente pague (por ejemplo, efectivo).",
};

/** Why a checkout didn't turn into a payment, read from Mercado Pago (read-only). */
export async function diagnosticoPago(o: { orderId: string; kind: "preference" | "subscription"; id: string }) {
  const intentos: { status: string; detalle: string; motivo: string; fecha?: string; monto?: number }[] = [];
  let suscripcion: string | null = null;
  if (o.kind === "subscription") {
    const pre = await getPreapproval(o.id).catch(() => null);
    suscripcion = pre?.status ?? null;
  }
  const r = await mp<{ results?: { id: number; status: string; status_detail?: string; date_created?: string; transaction_amount?: number }[] }>(
    `/v1/payments/search?external_reference=${encodeURIComponent(o.orderId)}&sort=date_created&criteria=desc&limit=20`,
  ).catch(() => ({ results: [] }));
  for (const p of r.results ?? []) {
    const det = p.status_detail ?? "";
    intentos.push({ status: p.status, detalle: det, motivo: MOTIVOS[det] ?? (p.status === "approved" ? "Aprobado." : `${p.status} (${det || "sin detalle"})`), fecha: p.date_created, monto: p.transaction_amount });
  }
  const resumen = intentos.length
    ? intentos[0].motivo
    : suscripcion === "pending" || (o.kind === "preference")
      ? "Abandono: abrió el pago de Mercado Pago pero nunca intentó pagar (no hay ningún intento registrado)."
      : `Suscripción en estado «${suscripcion ?? "desconocido"}», sin intentos de pago.`;
  return { resumen, intentos, suscripcion };
}
