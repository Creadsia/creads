import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { addOrder, hasPaidBefore, orders, workspaceRow } from "@/lib/billing";
import { type ItemId, METHODS, type MethodId, type Period, quote } from "@/lib/catalog";
import { tooMany } from "@/lib/rate";
import { sendMeta, visitorFrom } from "@/lib/meta";

export const dynamic = "force-dynamic";

// The customer's side of payments. Online payment (Stripe / Mercado Pago) isn't connected yet:
// an order is saved and Creadsia completes it by hand (the owner sees it in the panel).
// The amount is always computed here, never taken from the browser.

const ONLINE = false; // turns true when a payment provider is connected

export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const ws = s.user.workspace;
  if (ws === "main") return NextResponse.json({ online: ONLINE, owner: true, firstPurchase: true, discount: 0, orders: [] });
  try {
    const [w, paid, all] = await Promise.all([workspaceRow(ws), hasPaidBefore(ws), orders()]);
    return NextResponse.json({
      online: ONLINE, owner: false, firstPurchase: !paid, discount: Number(w.discount ?? 0),
      orders: all.filter((o) => o.ws === ws).slice(0, 10).map(({ id, item, period, method, quote: q, status, created }) => ({ id, item, period, method, total: q.total, label: q.label, status, created })),
    });
  } catch {
    return NextResponse.json({ online: ONLINE, owner: false, firstPurchase: true, discount: 0, orders: [] });
  }
}

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("heavy", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const period: Period = b?.period === "anual" ? "anual" : "mensual";
  const method = METHODS.find((m) => m.id === b?.method)?.id as MethodId | undefined;
  if (!method) return NextResponse.json({ error: "Elige cómo quieres pagar." }, { status: 400 });
  const ws = s.user.workspace;
  if (ws === "main") return NextResponse.json({ error: "Esta es la vista de cliente: tu cuenta no paga." }, { status: 400 });
  try {
    const [w, paid] = await Promise.all([workspaceRow(ws), hasPaidBefore(ws)]);
    const q = quote(String(b?.item ?? "") as ItemId, period, { discountPct: Number(w.discount ?? 0), firstPurchase: !paid });
    if (!q) return NextResponse.json({ error: "Plan desconocido." }, { status: 400 });
    const visitor = visitorFrom(req);
    const order = await addOrder({ ws, wsName: w.name, email: s.user.email, item: q.item, period: q.period, method, quote: q, visitor });
    await sendMeta({ name: "InitiateCheckout", eventId: typeof b?.eventId === "string" ? b.eventId : undefined, email: s.user.email, value: q.total, content: q.label }, visitor);
    return NextResponse.json({ online: ONLINE, order: { id: order.id, label: q.label, total: q.total, method } });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar tu pedido. Escríbenos a hola@creadsia.com." }, { status: 502 });
  }
}
