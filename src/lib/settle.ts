import { type Order, orders, recordIncome, recordPlanPayment, updateOrder } from "./billing";
import { PACKS } from "./catalog";
import { AlreadyDone, grant } from "./credits";
import { sendMeta } from "./meta";
import { setSubscriptionAmount } from "./mercadopago";

// Applies a payment confirmed by Mercado Pago to its order: credits, plan date, income in the book and
// the Meta "Purchase". Safe to call many times for the same payment (it counts once, enforced by the
// database), which matters because Mercado Pago repeats notifications.

export interface Paid { id: string; amount: number; currency: string }

export async function settleOrder(orderId: string, pay: Paid): Promise<{ ok: boolean; already?: boolean; reason?: string }> {
  const order: Order | undefined = (await orders()).find((o) => o.id === orderId);
  if (!order) return { ok: false, reason: "pedido no encontrado" };
  if (pay.currency !== "CLP") return { ok: false, reason: `moneda inesperada ${pay.currency}` };
  // the amount must be what we asked for (first month may carry the launch offer)
  const expected = order.status === "pendiente" ? order.mp?.clp ?? 0 : order.mp?.fullClp ?? order.mp?.clp ?? 0;
  if (expected && pay.amount < expected * 0.99) {
    console.error("payment below expected", orderId, pay.id, pay.amount, expected);
    return { ok: false, reason: "monto menor al esperado" };
  }

  const ref = `mp:${pay.id}`;
  const pack = PACKS.find((p) => p.id === order.item);
  try {
    if (pack) {
      await grant(order.ws, pack.credits, "topup", `Compra ${pack.credits.toLocaleString("es-CL")} créditos · ${order.id}`, "mercadopago", ref);
      await recordIncome(order.wsName, `${pack.credits.toLocaleString("es-CL")} créditos extra · ${order.id}`, pay.amount, "CLP");
    } else {
      await recordPlanPayment(order.ws, order.item, order.period === "anual" ? 12 : 1, { note: order.id, amount: pay.amount, currency: "CLP", by: "mercadopago", ref });
    }
  } catch (err) {
    if (err instanceof AlreadyDone) return { ok: true, already: true };
    throw err;
  }

  const first = order.status === "pendiente";
  await updateOrder(order.id, (o) => {
    o.payments = [...(o.payments ?? []), pay.id];
    if (o.status === "pendiente") { o.status = "pagado"; o.closed = new Date().toISOString(); }
  });
  // launch offer done: from the second month the subscription charges the regular price
  if (first && order.mp?.kind === "subscription" && order.mp.fullClp && order.mp.fullClp !== order.mp.clp) {
    await setSubscriptionAmount(order.mp.id, order.mp.fullClp).catch((e) => console.error("raise subscription amount", order.id, e instanceof Error ? e.message : e));
  }
  if (order.visitor) {
    await sendMeta({ name: "Purchase", eventId: `buy-${order.id}-${pay.id}`, email: order.email, value: pay.amount, currency: "CLP", content: order.quote.label }, { ...order.visitor, url: "https://www.creadsia.com/app/planes" });
  }
  return { ok: true };
}
