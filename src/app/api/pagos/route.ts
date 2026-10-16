import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { addOrder, hasPaidBefore, ordersOf, setOrderMp, workspaceRow } from "@/lib/billing";
import { type ItemId, METHODS, type MethodId, PLANS, type Period, clpFor, quote } from "@/lib/catalog";
import { usdClpRate } from "@/lib/usd-clp";
import { sendMeta, visitorFrom } from "@/lib/meta";
import { createPreference, createSubscription, mpReady } from "@/lib/mercadopago";
import { tooMany } from "@/lib/rate";

export const dynamic = "force-dynamic";

// The customer's side of payments. With Mercado Pago connected (MP_ACCESS_TOKEN), "Tarjeta o Mercado
// Pago" sends the customer to pay online: monthly plans become a monthly subscription, yearly plans
// and credit top-ups a one-time payment. Without it, orders wait in the owner's panel.
// The amount is always computed here, never taken from the browser.

const usdClp = usdClpRate;

export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const ws = s.user.workspace;
  const rate = await usdClp();
  if (ws === "main") return NextResponse.json({ online: mpReady(), owner: true, firstPurchase: true, discount: 0, usdClp: rate, orders: [], subscription: null });
  try {
    const [w, paid, mine] = await Promise.all([workspaceRow(ws), hasPaidBefore(ws), ordersOf(ws)]);
    const sub = mine.find((o) => o.status === "pagado" && o.mp?.kind === "subscription" && !o.mp.cancelled);
    return NextResponse.json({
      online: mpReady(), owner: false, firstPurchase: !paid, discount: Number(w.discount ?? 0), usdClp: rate,
      subscription: sub ? { id: sub.id, label: sub.quote.label } : null,
      orders: mine.filter((o) => o.status !== "reemplazado").slice(0, 10).map(({ id, item, period, method, quote: q, status, created }) => ({ id, item, period, method, total: q.total, label: q.label, status, created })),
    });
  } catch {
    return NextResponse.json({ online: mpReady(), owner: false, firstPurchase: true, discount: 0, usdClp: rate, orders: [], subscription: null });
  }
}

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("heavy", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const period: Period = b?.period === "anual" ? "anual" : "mensual";
  const method = METHODS.find((m) => m.id === (b?.method ?? "mercadopago"))?.id as MethodId | undefined;
  if (!method) return NextResponse.json({ error: "Elige cómo quieres pagar." }, { status: 400 });
  const ws = s.user.workspace;
  if (ws === "main") return NextResponse.json({ error: "Esta es la vista de cliente: tu cuenta no paga." }, { status: 400 });
  try {
    const [w, paid, rate] = await Promise.all([workspaceRow(ws), hasPaidBefore(ws), usdClp()]);
    const discountPct = Number(w.discount ?? 0);
    const q = quote(String(b?.item ?? "") as ItemId, period, { discountPct, firstPurchase: !paid });
    if (!q) return NextResponse.json({ error: "Plan desconocido." }, { status: 400 });
    const visitor = visitorFrom(req);
    const order = await addOrder({ ws, wsName: w.name, email: s.user.email, item: q.item, period: q.period, method, quote: q, visitor });
    await sendMeta({ name: "InitiateCheckout", eventId: typeof b?.eventId === "string" ? b.eventId : undefined, email: s.user.email, value: q.total, content: q.label }, visitor);

    let redirect: string | null = null;
    if (method === "mercadopago" && mpReady()) {
      const clp = clpFor(q.total, rate);
      const title = `Creads IA · ${q.label}`;
      if (q.period === "mensual") {
        // monthly plan: subscription; the first charge may carry the launch offer
        const plan = PLANS.find((p) => p.id === q.item)!;
        const fullClp = clpFor(plan.monthly * (1 - discountPct / 100), rate);
        const sub = await createSubscription({ orderId: order.id, title, firstClp: clp, email: s.user.email });
        await setOrderMp(order.id, { kind: "subscription", id: sub.id, clp, fullClp });
        redirect = sub.url;
      } else {
        const pref = await createPreference({ orderId: order.id, title, clp, email: s.user.email });
        await setOrderMp(order.id, { kind: "preference", id: pref.id, clp });
        redirect = pref.url;
      }
    }
    return NextResponse.json({ online: Boolean(redirect), redirect, order: { id: order.id, label: q.label, total: q.total, clp: clpFor(q.total, rate), method } });
  } catch (err) {
    console.error("pagos", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No se pudo preparar el pago. Intenta de nuevo o escríbenos a hola@creadsia.com." }, { status: 502 });
  }
}
