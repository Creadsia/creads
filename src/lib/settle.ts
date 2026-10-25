import { type Order, applyPayment, getOrder, recordIncome } from "./billing";
import { phCapture } from "./posthog-server";
import { findUserByEmail } from "./auth";
import { PACKS, PLANS, PRUEBA } from "./catalog";
import { sendMeta } from "./meta";
import { sendEmail } from "./providers/email";
import { ownerSaleEmail, receiptEmail } from "./emails";
import { ownerAddress } from "./errlog";
import { phoneAlert } from "./phone-alert";
import { beforeNewPeriod } from "./expiry";
import { getPayment, getPreapproval, setSubscriptionAmount, subscriptionPaymentIds } from "./mercadopago";
import { comisionPorPago } from "./afiliados";

// Applies a payment confirmed by Mercado Pago (or by the owner) to its order. The money part
// (credits, plan date, order paid) happens in one database transaction and only once per payment, so
// repeated notifications, the return page and the webhook racing each other can't double anything.
// The rest (income in the book, Meta, raising the subscription to its regular price) is best-effort
// and retried on the next notification.

export interface Paid { id: string; amount: number; currency: string }

/** What an order gives: credits and months of plan (0 for a top-up). */
export function orderGrant(o: Order) {
  // the Pack Prueba gives what its order promised (older ones: the 15 s trial video, 200 credits)
  if (o.item === PRUEBA.id) return { credits: Number(o.quote?.credits) > 0 ? Number(o.quote.credits) : PRUEBA.credits, months: 0, plan: null as string | null };
  const pack = PACKS.find((p) => p.id === o.item);
  if (pack) return { credits: pack.credits, months: 0, plan: null as string | null };
  // a pack that's no longer sold: the credits stored in the order when it was placed
  if (o.item.startsWith("pack-") && Number(o.quote?.credits) > 0) return { credits: Number(o.quote.credits), months: 0, plan: null as string | null };
  const plan = PLANS.find((p) => p.id === o.item);
  if (!plan) throw new Error(`plan desconocido: ${o.item}`);
  const months = o.period === "anual" ? 12 : 1;
  // the balance promised when the subscription started (plan_version), so a later change of plans
  // never lowers — or raises — what an existing subscriber gets on each renewal
  const perMonth = Number(o.quote?.monthlyCredits) > 0 ? Number(o.quote.monthlyCredits) : plan.credits;
  return { credits: perMonth * months, months, plan: plan.name };
}

/**
 * Keeps a monthly subscription at the right price after each payment: the first month may be cheaper (Pack
 * Prueba discount), months 2..promoMonths at the founder price (midClp), then the regular price (fullClp).
 */
async function ensureRegularPrice(o: Order, paidNow: number) {
  if (o.mp?.kind !== "subscription" || !o.mp.fullClp) return;
  const months = Math.max(1, o.mp.promoMonths ?? 1);
  const target = paidNow < months ? (o.mp.midClp ?? o.mp.fullClp) : o.mp.fullClp;
  if (!(target > 0)) return;
  try {
    const sub = await getPreapproval(o.mp.id);
    if (Math.abs((sub.auto_recurring?.transaction_amount ?? 0) - target) >= 1 && sub.status !== "cancelled") await setSubscriptionAmount(o.mp.id, target);
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
  await ensureRegularPrice(order, new Set([...(order.payments ?? []), `${source}:${pay.id}`]).size);
  if (r === "already") return { ok: true, already: true };

  // affiliate program: the commission of this payment, if the customer came through an affiliate (never throws)
  await comisionPorPago({ paymentId: `${source}:${pay.id}`, ws: order.ws, amount: pay.amount, currency: pay.currency, months: g.months, orderId: order.id, label: order.quote.label });

  await (await import("./eventos")).registrarEvento("pago", {
    cuenta: order.ws, correo: order.email, item: order.item, plan: order.quote.label, monto: pay.amount, moneda: pay.currency, pedido: order.id,
    renovacion: (order.payments ?? []).some((p) => p !== `${source}:${pay.id}`),
  });
  await recordIncome(order.wsName, `${order.quote.label} · ${order.id}`, pay.amount, pay.currency === "CLP" ? "CLP" : "USD").catch((e) => console.error("income", order.id, e instanceof Error ? e.message : e));
  if (order.email) {
    await sendEmail(receiptEmail(order.email, { label: order.quote.label, credits: g.credits, amount: pay.amount, currency: pay.currency, orderId: order.id, paymentId: `${pay.id}` }));
    // first payment of a plan: the welcome with what to do next (funnel emails, once approved by the owner)
    if (process.env.CORREOS_COMPORTAMIENTO === "1" && g.months > 0 && !(order.payments ?? []).some((p) => p !== `${source}:${pay.id}`)) {
      const { embudoEmail } = await import("./emails");
      await sendEmail(embudoEmail(order.email, null, "pago-bienvenida")).catch(() => null);
    }
  }
  // the owner hears about every sale right away (email to Creadsia's owner)
  try {
    const to = await ownerAddress();
    const renewal = (order.payments ?? []).some((p) => p !== `${source}:${pay.id}`);
    const money = pay.currency === "CLP" ? `$${Math.round(pay.amount).toLocaleString("es-CL")}` : `US$${pay.amount}`;
    await phoneAlert({ title: renewal ? `🔁 Renovación: ${money}` : `💰 ¡Nueva venta! ${money}`, text: `${order.quote.label}${renewal ? " · se renovó" : " · cliente nuevo"}`, priority: 5 });
    if (to) await sendEmail(ownerSaleEmail(to, { label: order.quote.label, amount: pay.amount, currency: pay.currency, customer: order.email ?? "", account: order.wsName ?? "", renewal, orderId: order.id }));
  } catch (e) { console.error("owner sale email", order.id, e instanceof Error ? e.message : e); }
  // PostHog «purchase», by the server, with the same id as Meta's Purchase so a repeated notification counts once
  {
    const firstPay = !(order.payments ?? []).some((p) => p !== `${source}:${pay.id}`);
    const user = order.email ? await findUserByEmail(order.email).catch(() => null) : null;
    await phCapture(user?.id ?? order.ws, "purchase", { item: order.item, plan: order.quote.label, valor: pay.amount, moneda: pay.currency, renovacion: !firstPay, pedido: order.id, fuente: order.visitor?.src ?? null, campana: order.visitor?.camp ?? null }, firstPay ? `buy-${order.id}` : `buy-${order.id}-${pay.id}`);
  }
  if (order.visitor) {
    // the first payment uses «buy-<order>», the same id the browser fires on the thank-you screen (Meta counts it
    // once); renewals keep their own id per payment
    const firstPay = !(order.payments ?? []).some((p) => p !== `${source}:${pay.id}`);
    await sendMeta({ name: "Purchase", eventId: firstPay ? `buy-${order.id}` : `buy-${order.id}-${pay.id}`, email: order.email, value: pay.amount, currency: pay.currency, content: order.quote.label }, { ...order.visitor, url: "https://www.creadsia.com/app/planes" });
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
