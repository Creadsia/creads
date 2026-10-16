import { randomBytes } from "node:crypto";
import { forgetWorkspace } from "./auth";
import type { ItemId, MethodId, Period, Quote } from "./catalog";
import { CreditError, grant } from "./credits";
import { DEFAULT_FINANZAS, type Finanzas } from "./finance";
import { readPrivateJSON, sbRest, writePrivateJSON } from "./supabase";

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
  return (await readPrivateJSON<Finanzas>("finanzas.json").catch(() => null)) ?? DEFAULT_FINANZAS;
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
export async function recordPlanPayment(ws: string, planId: string, months: number, opts: { note?: string; amount?: number | null; currency?: "USD" | "CLP"; by: string }) {
  const w = await workspaceRow(ws);
  const b = await book();
  const plan = b.config.planes.find((p) => p.id === planId);
  if (!plan) throw new CreditError("Elige un plan.", 400);
  const m = Math.min(12, Math.max(1, Math.round(months)));
  const from = w.paid_until && w.paid_until > today() ? w.paid_until : today();
  const until = addMonths(from, m);
  const what = `Plan ${plan.nombre} · ${m === 1 ? "1 mes" : `${m} meses`}${opts.note ? ` · ${opts.note}` : ""}`;
  await grant(ws, plan.creditos * m, "plan", `Pago ${what}`, opts.by);
  await sbRest(`workspaces?id=eq.${encodeURIComponent(ws)}`, { method: "PATCH", body: JSON.stringify({ plan: plan.nombre, paid_until: until }) });
  forgetWorkspace(ws);
  if (opts.amount !== null) {
    const price = (m === 12 ? plan.anual * 12 : plan.mensual * m) * (1 - Number(w.discount ?? 0) / 100);
    await recordIncome(w.name, what, opts.amount && opts.amount > 0 ? opts.amount : +price.toFixed(2), opts.currency ?? "USD");
  }
  return until;
}

// ---------- customers' orders ----------

export interface Order {
  id: string;
  ws: string;
  wsName: string;
  email: string;
  item: ItemId;
  period: Period | null;
  method: MethodId;
  quote: Quote;
  status: "pendiente" | "pagado" | "cancelado";
  created: string;
  closed?: string;
}

const FILE = "pedidos.json";
export async function orders(): Promise<Order[]> {
  return (await readPrivateJSON<Order[]>(FILE).catch(() => null)) ?? [];
}
async function saveOrders(list: Order[]) {
  await writePrivateJSON(FILE, list.slice(0, 2000));
}

export async function addOrder(o: Omit<Order, "id" | "status" | "created">) {
  const list = await orders();
  const order: Order = { ...o, id: `CR-${randomBytes(3).toString("hex").toUpperCase()}`, status: "pendiente", created: new Date().toISOString() };
  // one open order per customer and item: a new click replaces the old one
  await saveOrders([order, ...list.filter((x) => !(x.ws === o.ws && x.item === o.item && x.status === "pendiente"))]);
  return order;
}

export async function setOrderStatus(id: string, status: "pagado" | "cancelado") {
  const list = await orders();
  const o = list.find((x) => x.id === id);
  if (!o) throw new CreditError("Pedido no encontrado.", 404);
  if (o.status !== "pendiente") throw new CreditError("Ese pedido ya estaba cerrado.", 409);
  o.status = status;
  o.closed = new Date().toISOString();
  await saveOrders(list);
  return o;
}

/** Did this customer ever pay a plan? (the launch discount is for the first month only) */
export async function hasPaidBefore(ws: string) {
  const rows = await sbRest<{ id: number }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&kind=eq.plan&select=id&limit=1`).catch(() => []);
  return rows.length > 0;
}
