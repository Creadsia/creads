import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { getOrder } from "@/lib/billing";
import { getPayment, getPreapproval } from "@/lib/mercadopago";
import { settleOrder } from "@/lib/settle";
import { tooMany } from "@/lib/rate";

export const dynamic = "force-dynamic";

// The customer came back from Mercado Pago: check the payment right away (instead of waiting for the
// notification) so the credits show at once. Same safe settlement as the webhook.
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("heavy", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const found = await getOrder(String(b?.pedido ?? "")).catch(() => null);
  const order = found && found.ws === s.user.workspace ? found : null;
  if (!order) return NextResponse.json({ error: "No encontré ese pedido." }, { status: 404 });
  try {
    if (order.status === "pagado") return NextResponse.json({ state: "pagado" });
    const paymentId = String(b?.payment_id ?? b?.collection_id ?? "");
    if (/^\d{3,30}$/.test(paymentId)) {
      const p = await getPayment(paymentId);
      if (p.external_reference !== order.id) return NextResponse.json({ error: "Ese pago no corresponde a este pedido." }, { status: 400 });
      if (p.status === "approved") {
        const r = await settleOrder(order.id, { id: String(p.id), amount: p.transaction_amount, currency: p.currency_id });
        return NextResponse.json({ state: r.ok ? "pagado" : "revisar" });
      }
      return NextResponse.json({ state: p.status === "rejected" ? "rechazado" : "procesando" });
    }
    const pre = String(b?.preapproval_id ?? "");
    if (pre && order.mp?.kind === "subscription" && pre === order.mp.id) {
      const sub = await getPreapproval(pre);
      // the first charge of a subscription arrives a few seconds/minutes later, by notification
      return NextResponse.json({ state: sub.status === "authorized" ? "procesando" : sub.status === "cancelled" ? "cancelado" : "pendiente" });
    }
    return NextResponse.json({ state: "pendiente" });
  } catch {
    return NextResponse.json({ state: "procesando" });
  }
}
