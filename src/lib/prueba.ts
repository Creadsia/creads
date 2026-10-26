import { type Order, addOrder, cancelOrder, ordersOf, setOrderMp, workspaceRow } from "./billing";
import { PLANS, clpFor, quote } from "./catalog";
import { cancelSubscription, createSubscription, createSubscriptionWithCard, getPreapproval, SITE } from "./mercadopago";
import { PRUEBA_DIAS, PRUEBA_PLAN, REGALO_CREDITS, darRegalo, hasPaid } from "./regalo";
import { sendMeta, type Visitor } from "./meta";
import { phoneAlert } from "./phone-alert";
import { sbRest } from "./supabase";
import { trialEndingEmail } from "./emails";
import { sendEmail } from "./providers/email";
import { once } from "./marketing";
import { getOrder } from "./billing";
import { usdClpRate } from "./usd-clp";

// «Prueba gratis con tarjeta» (owner, 25 Oct 2026; required at sign-up since 26 Oct 2026): the customer adds a
// card (inside Creads with Mercado Pago's secure fields, or on Mercado Pago's page). Nothing is charged today; the
// gift credits load as soon as the card is accepted; after PRUEBA_DIAS days Mercado Pago charges the PRUEBA_PLAN
// plan (Testea since 26 Oct 2026; trials started before keep the Básico they were sold) every month unless the
// customer cancels first (Planes → cancelar, or Mercado Pago). It is an ordinary monthly subscription whose first
// charge has a later start date, so the first charge and the renewals settle through the same webhook as any plan
// (settle.ts: the order's quote carries Testea's monthlyCredits).

export { PRUEBA_PLAN };

/** The plan the trial becomes, with what the customer is told: name, US$ a month, credits a month. */
export function planPrueba() {
  const p = PLANS.find((x) => x.id === PRUEBA_PLAN)!;
  return { id: p.id, name: p.name, usd: p.monthly, credits: p.credits };
}

/** What the trial says everywhere (sign-up summary, lock, welcome email): days, gift, plan, price. */
export function resumenPrueba() {
  const p = planPrueba();
  return { dias: PRUEBA_DIAS, regalo: REGALO_CREDITS, plan: p.name, usd: p.usd, credits: p.credits };
}

/** The trial order of this workspace that can still charge (not cancelled, not yet paid). */
export async function pruebaAbierta(ws: string): Promise<Order | null> {
  return (await ordersOf(ws)).find((o) => o.mp?.trial && !o.mp.cancelled && o.status === "pendiente") ?? null;
}

/** Has this workspace ever started a card trial (one per account)? */
export async function tuvoPrueba(ws: string) {
  return (await ordersOf(ws)).some((o) => Boolean(o.mp?.trial) && o.status !== "reemplazado");
}

export function fechaCobro(days = PRUEBA_DIAS) {
  const d = new Date(Date.now() + days * 86400_000);
  return d;
}

/** Creates the trial subscription and returns Mercado Pago's page to add the card. */
export async function empezarPrueba(u: { ws: string; email: string }, visitor?: Visitor) {
  const w = await workspaceRow(u.ws);
  const rate = await usdClpRate().catch(() => 950);
  const q = quote(PRUEBA_PLAN, "mensual", { firstPurchase: false })!;
  const order = await addOrder({ ws: u.ws, wsName: w.name, email: u.email, item: q.item, period: q.period, method: "mercadopago", quote: q, visitor });
  const plan = PLANS.find((p) => p.id === PRUEBA_PLAN)!;
  const clp = clpFor(plan.monthly, rate);
  const start = fechaCobro();
  const sub = await createSubscription({
    orderId: order.id, title: `Creads IA · Plan ${plan.name} (prueba gratis ${PRUEBA_DIAS} días)`, firstClp: clp, email: u.email,
    startDate: start.toISOString(), backUrl: `${SITE}/app/automatico?prueba=${encodeURIComponent(order.id)}`,
  });
  await setOrderMp(order.id, { kind: "subscription", id: sub.id, clp, fullClp: clp, trial: start.toISOString().slice(0, 10) });
  return { url: sub.url, order: order.id, clp, cobro: start.toISOString().slice(0, 10) };
}

/** The trial with the card typed inside Creads: authorized at once, the gift loads right away. */
export async function empezarPruebaConTarjeta(u: { ws: string; email: string }, cardToken: string, visitor?: Visitor) {
  const w = await workspaceRow(u.ws);
  const rate = await usdClpRate().catch(() => 950);
  const q = quote(PRUEBA_PLAN, "mensual", { firstPurchase: false })!;
  const order = await addOrder({ ws: u.ws, wsName: w.name, email: u.email, item: q.item, period: q.period, method: "mercadopago", quote: q, visitor });
  const plan = PLANS.find((p) => p.id === PRUEBA_PLAN)!;
  const clp = clpFor(plan.monthly, rate);
  const start = fechaCobro();
  const sub = await createSubscriptionWithCard({ orderId: order.id, title: `Creads IA · Plan ${plan.name} (prueba gratis ${PRUEBA_DIAS} días)`, clp, email: u.email, cardToken, startDate: start.toISOString() });
  await setOrderMp(order.id, { kind: "subscription", id: sub.id, clp, fullClp: clp, trial: start.toISOString().slice(0, 10) });
  const o = await getOrder(order.id);
  return o ? activarPrueba(o) : "pendiente";
}

/** The card was accepted (subscription authorized): load the gift, once. Safe to call many times. */
export async function activarPrueba(o: Order): Promise<"ok" | "pendiente" | "cancelado" | "no"> {
  if (!o.mp?.trial) return "no";
  const pre = await getPreapproval(o.mp.id);
  if (pre.status === "cancelled") return "cancelado";
  if (pre.status !== "authorized") return "pendiente";
  if (await hasPaid(o.ws)) return "ok";
  const r = await darRegalo(o.ws, o.email, { conTarjeta: true });
  if (r.ok) {
    await phoneAlert({ title: "🃏 Prueba con tarjeta", text: `${o.email} agregó su tarjeta (cobro el ${o.mp.trial})`, priority: 3 }).catch(() => null);
    if (o.visitor) await sendMeta({ name: "StartTrial", eventId: `trial-${o.id}`, email: o.email, value: 0, currency: "CLP", content: o.quote.label }, o.visitor).catch(() => null);
  }
  return r.ok || r.why === "ya" ? "ok" : "no";
}

/** Stops the trial before its first charge (the gift stays). */
export async function cancelarPrueba(o: Order) {
  if (!o.mp?.trial) return;
  await cancelSubscription(o.mp.id);
  await setOrderMp(o.id, { ...o.mp, cancelled: true });
  await cancelOrder(o.id).catch(() => null);
}

/** Daily: the day before the first charge, one plain email (date, plan, amount, how to cancel). */
export async function avisarFinPrueba(): Promise<number> {
  const manana = new Date(Date.now() + 86400_000).toISOString().slice(0, 10);
  const rows = await sbRest<{ id: string }[]>(`orders?status=eq.pendiente&mp->>trial=eq.${manana}&select=id&limit=500`).catch(() => []);
  let n = 0;
  for (const r of rows) {
    const o = await getOrder(r.id).catch(() => null);
    if (!o?.mp?.trial || o.mp.cancelled || !o.email) continue;
    const pre = await getPreapproval(o.mp.id).catch(() => null);
    if (pre?.status !== "authorized") continue;
    if (!(await once(`prueba-fin:${o.id}`, 30 * 86400))) continue;
    const ads = (await sbRest<{ id: number }[]>(`credits?owner=eq.${encodeURIComponent(o.ws)}&kind=eq.charge&select=id&limit=50`).catch(() => [])).length;
    const fecha = new Date(`${o.mp.trial}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long" });
    // the plan this trial was sold with (older trials: Básico), with its own price and monthly credits
    const plan = PLANS.find((p) => p.id === o.item) ?? PLANS.find((p) => p.id === PRUEBA_PLAN)!;
    const credits = Number(o.quote?.monthlyCredits) > 0 ? Number(o.quote.monthlyCredits) : plan.credits;
    if (await sendEmail(trialEndingEmail(o.email, null, { fecha, plan: plan.name, usd: plan.monthly, clp: o.mp.clp, credits, ads }))) n++;
  }
  return n;
}
