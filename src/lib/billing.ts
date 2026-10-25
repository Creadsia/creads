import { randomBytes } from "node:crypto";
import { forgetWorkspace } from "./auth";
import type { ItemId, MethodId, Period, Quote } from "./catalog";
import { CreditError, grant } from "./credits";
import { DEFAULT_FINANZAS, type Finanzas, withCurrentPlans } from "./finance";
import type { Visitor } from "./meta";
import { beforeNewPeriod } from "./expiry";
import { readPrivateJSON, sbRest, sbRpc, writePrivateJSON } from "./supabase";

// Payments: recording a paid plan or top-up (by hand today, by Stripe / Mercado Pago later) and the
// customers' orders waiting to be paid. Server-only.

interface Ws { id: string; name: string; plan: string | null; paid_until: string | null; discount: number }

export async function workspaceRow(ws: string): Promise<Ws> {
  const rows = await sbRest<Ws[]>(`workspaces?id=eq.${encodeURIComponent(ws)}&select=id,name,plan,paid_until,discount&limit=1`);
  if (!rows[0]) throw new CreditError("Cliente no encontrado.", 404);
  return rows[0];
}

export const addMonths = (iso: string, months: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // 31 Jan + 1 month = 28/29 Feb
  return d.toISOString().slice(0, 10);
};

const today = () => new Date().toISOString().slice(0, 10);

async function book() {
  return withCurrentPlans((await readPrivateJSON<Finanzas>("finanzas.json").catch(() => null)) ?? DEFAULT_FINANZAS);
}

/** Writes an income line in the owner's finance book. */
export async function recordIncome(who: string, detail: string, amount: number, currency: "USD" | "CLP" = "USD") {
  const b = await book();
  b.movimientos.unshift({ id: `pago-${Date.now()}-${randomBytes(2).toString("hex")}`, fecha: today(), tipo: "ingreso", servicio: who, detalle: detail, monto: amount, moneda: currency });
  await writePrivateJSON("finanzas.json", { ...b, actualizado: new Date().toISOString() });
}

/**
 * A plan was paid for `months`: gives the plan's credits for each month, moves the paid-until date
 * and (unless `amount` is null) writes the income. Returns the new paid-until date.
 */
export async function recordPlanPayment(ws: string, planId: string, months: number, opts: { note?: string; amount?: number | null; currency?: "USD" | "CLP"; by: string; ref?: string }) {
  const w = await workspaceRow(ws);
  const b = await book();
  const plan = b.config.planes.find((p) => p.id === planId);
  if (!plan) throw new CreditError("Elige un plan.", 400);
  const m = Math.min(12, Math.max(1, Math.round(months)));
  const from = w.paid_until && w.paid_until > today() ? w.paid_until : today();
  const until = addMonths(from, m);
  // a repeated payment (same ref) must not touch the period again
  const repeated = opts.ref ? (await sbRest<{ id: number }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&ref=eq.${encodeURIComponent(opts.ref)}&select=id&limit=1`).catch(() => [])).length > 0 : false;
  if (!repeated) await beforeNewPeriod(ws).catch((e) => console.error("expiry before period", ws, e instanceof Error ? e.message : e));
  const what = `Plan ${plan.nombre} · ${m === 1 ? "1 mes" : `${m} meses`}${opts.note ? ` · ${opts.note}` : ""}`;
  await grant(ws, plan.creditos * m, "plan", `Pago ${what}`, opts.by, opts.ref); // first: a repeated payment stops here
  await sbRest(`workspaces?id=eq.${encodeURIComponent(ws)}`, { method: "PATCH", body: JSON.stringify({ plan: plan.nombre, paid_until: until }) });
  forgetWorkspace(ws);
  if (opts.amount !== null) {
    const price = (m === 12 ? plan.anual * 12 : plan.mensual * m) * (1 - Number(w.discount ?? 0) / 100);
    await recordIncome(w.name, what, opts.amount && opts.amount > 0 ? opts.amount : +price.toFixed(2), opts.currency ?? "USD");
  }
  return until;
}

// ---------- customers' orders (table public.orders) ----------

export interface Order {
  id: string;
  ws: string;
  wsName: string;
  email: string;
  item: ItemId;
  period: Period | null;
  method: MethodId;
  quote: Quote;
  status: "pendiente" | "pagado" | "cancelado" | "reemplazado";
  created: string;
  closed?: string | null;
  /** For Meta: consent and browser ids at checkout, so the purchase can be matched later. */
  visitor?: Visitor | null;
  /** Online payment with Mercado Pago. */
  mp?: { kind: "preference" | "subscription"; id: string; clp: number; fullClp?: number; /** price of months 2..promoMonths (founder price) */ midClp?: number; /** months charged below fullClp (default 1) */ promoMonths?: number; cancelled?: boolean; /** free trial with card: first charge on this date */ trial?: string } | null;
  /** Payments already applied (a subscription adds one each month). */
  payments?: string[];
}

interface Row { id: string; owner: string; ws_name: string; email: string; item: string; period: string | null; method: string; quote: Quote; status: Order["status"]; mp: Order["mp"]; visitor: Visitor | null; payments: string[]; created_at: string; closed_at: string | null }
const fromRow = (r: Row): Order => ({
  id: r.id, ws: r.owner, wsName: r.ws_name, email: r.email, item: r.item as ItemId, period: (r.period as Period) ?? null, method: r.method as MethodId,
  quote: r.quote, status: r.status, mp: r.mp, visitor: r.visitor, payments: r.payments ?? [], created: r.created_at, closed: r.closed_at,
});

export async function orders(limit = 200): Promise<Order[]> {
  return (await sbRest<Row[]>(`orders?select=*&order=created_at.desc&limit=${limit}`)).map(fromRow);
}
export async function ordersOf(ws: string, limit = 20): Promise<Order[]> {
  return (await sbRest<Row[]>(`orders?owner=eq.${encodeURIComponent(ws)}&select=*&order=created_at.desc&limit=${limit}`)).map(fromRow);
}
export async function getOrder(id: string): Promise<Order | null> {
  if (!/^CR-[0-9A-F]{6,12}$/.test(id)) return null;
  return (await sbRest<Row[]>(`orders?id=eq.${encodeURIComponent(id)}&select=*&limit=1`)).map(fromRow)[0] ?? null;
}

export async function addOrder(o: { ws: string; wsName: string; email: string; item: ItemId; period: Period | null; method: MethodId; quote: Quote; visitor?: Visitor }) {
  const id = `CR-${randomBytes(4).toString("hex").toUpperCase()}`;
  // an older unpaid order for the same thing is replaced (kept, so a late payment for it still counts)
  const same = o.item.startsWith("pack-") ? `item=eq.${encodeURIComponent(o.item)}` : "item=in.(starter,plus,studio)"; // one open plan order at a time
  await sbRest(`orders?owner=eq.${encodeURIComponent(o.ws)}&${same}&status=eq.pendiente`, {
    method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ status: "reemplazado" }),
  });
  const rows = await sbRest<Row[]>("orders", {
    method: "POST",
    body: JSON.stringify({ id, owner: o.ws, ws_name: o.wsName, email: o.email, item: o.item, period: o.period, method: o.method, quote: o.quote, visitor: o.visitor ?? null }),
  });
  return fromRow(rows[0]);
}

export async function setOrderMp(id: string, mp: NonNullable<Order["mp"]>) {
  await sbRest(`orders?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ mp }) });
}

/** Cancels an unpaid order (only if it's still waiting). */
export async function cancelOrder(id: string) {
  const rows = await sbRest<Row[]>(`orders?id=eq.${encodeURIComponent(id)}&status=in.(pendiente,reemplazado)`, { method: "PATCH", body: JSON.stringify({ status: "cancelado", closed_at: new Date().toISOString() }) });
  if (!rows.length) throw new CreditError("Ese pedido ya estaba cerrado.", 409);
  return fromRow(rows[0]);
}

/**
 * Applies a confirmed payment to an order in one database transaction (credits, plan date, order
 * paid). Returns "already" if that payment was applied before.
 */
export async function applyPayment(p: { paymentId: string; orderId: string; amount: number; currency: string; credits: number; months: number; plan: string | null; note: string }) {
  const r = await sbRpc<string>("apply_payment", {
    p_payment: p.paymentId, p_order: p.orderId, p_amount: p.amount, p_currency: p.currency,
    p_credits: p.credits, p_months: p.months, p_plan: p.plan, p_note: p.note.slice(0, 200),
  });
  if (p.months > 0) {
    const o = await getOrder(p.orderId);
    if (o) forgetWorkspace(o.ws);
  }
  return r === "already" ? "already" : "applied";
}

/** Did this customer ever pay a plan? (the launch discount is for the first month only; unsure = yes) */
export async function hasPaidBefore(ws: string) {
  try {
    const rows = await sbRest<{ id: number }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&kind=eq.plan&select=id&limit=1`);
    return rows.length > 0;
  } catch {
    return true;
  }
}

// ---------- precio fundador and Pack Prueba discount (owner's plan, 25 Oct 2026) ----------

/** How many accounts already took the founder price (paid orders with it): the real counter on the site. */
export async function fundadoresUsados(): Promise<number> {
  const rows = await sbRest<{ owner: string }[]>("orders?status=eq.pagado&quote->>fundador=not.is.null&select=owner&limit=1000").catch(() => []);
  return new Set(rows.map((r) => r.owner)).size;
}

/** The Pack Prueba paid in the last `days` days whose price hasn't been discounted from a plan yet. */
export async function packParaDescontar(ws: string, days: number): Promise<{ order: string; usd: number } | null> {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const packs = await sbRest<{ id: string; quote: { total?: number } }[]>(`orders?owner=eq.${encodeURIComponent(ws)}&item=eq.pack-prueba&status=eq.pagado&closed_at=gte.${since}&select=id,quote&order=closed_at.desc&limit=3`).catch(() => []);
  for (const p of packs) {
    const used = await sbRest<{ id: string }[]>(`orders?owner=eq.${encodeURIComponent(ws)}&status=eq.pagado&quote->>packOrder=eq.${encodeURIComponent(p.id)}&select=id&limit=1`).catch(() => [{ id: "?" }]);
    if (!used.length && Number(p.quote?.total) > 0) return { order: p.id, usd: Number(p.quote.total) };
  }
  return null;
}
