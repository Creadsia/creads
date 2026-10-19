import { type Order, applyPayment, getOrder, recordIncome } from "./billing";
import { PACKS, PLANS } from "./catalog";
import { sendMeta } from "./meta";
import { sendEmail } from "./providers/email";
import { receiptEmail } from "./emails";
import { beforeNewPeriod } from "./expiry";
import { getPayment, getPreapproval, setSubscriptionAmount, subscriptionPaymentIds } from "./mercadopago";

// Applies a payment confirmed by Mercado Pago (or by the owner) to its order. The money part
// (credits, plan date, order paid) happens in one database transaction and only once per payment, so
// repeated notifications, the return page and the webhook racing each other can't double anything.
// The rest (income in the book, Meta, raising the subscription to its regular price) is best-effort
// and retried on the next notification.

export interface Paid { id: string; amount: number; currency: string }

/** What an order gives: credits and months of plan (0 for a top-up). */
export function orderGrant(o: Order) {
  const pack = PACKS.find((p) => p.id === o.item);
  if (pack) return { credits: pack.credits, months: 0, plan: null as string | null };
  // a pack that's no longer sold: the credits stored in the order when it was placed
  if (o.item.startsWith("pack-") && Number(o.quote?.credits) > 0) return { credits: Number(o.quote.credits), months: 0, plan: null as string | null };
  const plan = PLANS.find((p) => p.id === o.item);
  if (!plan) throw new Error(`plan desconocido: ${o.item}`);
  const months = o.period === "anual" ? 12 : 1;
  return { credits: plan.credits * months, months, plan: plan.name };
}

/** Keeps a monthly subscription at its regular price once the launch month is paid. */
async function ensureRegularPrice(o: Order) {
  if (o.mp?.kind !== "subscription" || !o.mp.fullClp || o.mp.fullClp <= o.mp.clp) return;
  try {
    const sub = await getPreapproval(o.mp.id);
    if ((sub.auto_recurring?.transaction_amount ?? 0) < o.mp.fullClp && sub.status !== "cancelled") await setSubscriptionAmount(o.mp.id, o.mp.fullClp);
  } catch (e) {
    console.error("subscription price", o.id, e instanceof Error ? e.message : e);
  }
}

/** Throws when it should be retried (unknown order, database down); returns ok:false when it must not count. */
export async function settleOrder(orderId: string, pay: Paid, source: "mp" | "manual" = "mp"): Promise<{ ok: boolean; already?: boolean; reason?: string }> {
  const order = await getOrder(orderId);
  if (!order) throw new Error(`pedido ${orderId} no encontrado`);
  if (source === "mp") {
    if (pay.currency !== "CLP") return { ok: false, reason: `moneda inesperada ${pay.currency}` };
    // never below the first price we asked for (renewals are at the regular price, which is higher)
    const floor = order.mp?.clp ?? 0;
    if (!floor || pay.amount < floor * 0.99) {
      console.error("payment below expected", orderId, pay.id, pay.amount, floor);
      return { ok: false, reason: "monto menor al esperado" };
    }
  }
  // A one-time order paid twice (marked paid by hand, then Mercado Pago confirms; or the reverse) only
  // counts once. Subscriptions are the exception: each month is a new payment on the same order.
  if (order.mp?.kind !== "subscription" && order.status === "pagado") {
    const other = (order.payments ?? []).some((p) => !p.startsWith(`${source}:`));
    if (other) return { ok: true, already: true };
  }
  const g = orderGrant(order);
  // a plan starts a new period: the credits left from the previous one expire (now, or when it ends)
  if (g.months > 0 && !(order.payments ?? []).includes(`${source}:${pay.id}`)) {
    await beforeNewPeriod(order.ws).catch((e) => console.error("expiry before period", order.id, e instanceof Error ? e.message : e));
  }
  const r = await applyPayment({
    paymentId: `${source}:${pay.id}`, orderId: order.id, amount: pay.amount, currency: pay.currency,
    credits: g.credits, months: g.months, plan: g.plan, note: `${order.quote.label} · ${order.id}`,
  });
  await ensureRegularPrice(order);
  if (r === "already") return { ok: true, already: true };

  await recordIncome(order.wsName, `${order.quote.label} · ${order.id}`, pay.amount, pay.currency === "CLP" ? "CLP" : "USD").catch((e) => console.error("income", order.id, e instanceof Error ? e.message : e));
  if (order.email) {
    await sendEmail(receiptEmail(order.email, { label: order.quote.label, credits: g.credits, amount: pay.amount, currency: pay.currency, orderId: order.id, paymentId: `${pay.id}` }));
  }
  if (order.visitor) {
    await sendMeta({ name: "Purchase", eventId: `buy-${order.id}-${pay.id}`, email: order.email, value: pay.amount, currency: pay.currency, content: order.quote.label }, { ...order.visitor, url: "https://www.creadsia.com/app/planes" });
  }
  return { ok: true };
}

/**
 * Safety net for subscriptions: asks Mercado Pago for the approved charges of this order's subscription and
 * applies any that the notifications missed. Each charge is applied by its own payment id, so a late
 * notification for the same charge does nothing. Returns how many were applied now.
 */
export async function reconcileSubscription(orderId: string): Promise<number> {
  const o = await getOrder(orderId);
  if (!o?.mp || o.mp.kind !== "subscription") return 0;
  let n = 0;
  for (const id of await subscriptionPaymentIds(o.mp.id, o.id)) {
    if ((o.payments ?? []).includes(`mp:${id}`)) continue;
    const p = await getPayment(id).catch(() => null);
    if (!p || p.status !== "approved") continue;
    const r = await settleOrder(o.id, { id: String(p.id), amount: p.transaction_amount, currency: p.currency_id }).catch((e) => { console.error("reconcile", o.id, id, e instanceof Error ? e.message : e); return null; });
    if (r?.ok && !r.already) n++;
  }
  return n;
}
