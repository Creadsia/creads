import { NextResponse } from "next/server";
import { currentUser } from "@/lib/admin";
import { isTheOwner } from "@/lib/auth";
import { getOrder, recordIncome, setOrderMp } from "@/lib/billing";
import { AlreadyDone, grant } from "@/lib/credits";
import { cancelSubscription, getPayment, refundPayment } from "@/lib/mercadopago";
import { orderGrant } from "@/lib/settle";

export const dynamic = "force-dynamic";

// «Reembolsar» (owner only): gives a Mercado Pago payment back in full, takes back the credits it gave (same
// reference as the refund notice, so only once), stops the subscription's renewal and writes the refund in the
// finance book. POST {id: order id, payment?: "mp:<id>" (default: the last one)}.
export async function POST(req: Request) {
  const u = await currentUser().catch(() => null);
  if (!isTheOwner(u)) return NextResponse.json({ error: "Solo el dueño puede devolver dinero." }, { status: 401 });
  const b = await req.json().catch(() => null);
  const o = await getOrder(String(b?.id ?? "")).catch(() => null);
  if (!o) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  const mpPays = (o.payments ?? []).filter((p) => p.startsWith("mp:"));
  const ref = typeof b?.payment === "string" && mpPays.includes(b.payment) ? b.payment : mpPays[mpPays.length - 1];
  if (!ref) return NextResponse.json({ error: "Ese pedido no tiene un pago de Mercado Pago para devolver (si se pagó a mano, devuélvelo por transferencia)." }, { status: 400 });
  const payId = ref.slice(3);
  try {
    const p = await getPayment(payId);
    if (p.status !== "refunded") await refundPayment(payId);
    const g = orderGrant(o);
    await grant(o.ws, -g.credits, "adjust", `Reembolso · ${o.id}`, u!.email, `pay:rev:mp:${payId}`).catch((e) => { if (!(e instanceof AlreadyDone)) throw e; });
    if (o.mp?.kind === "subscription" && !o.mp.cancelled) {
      await cancelSubscription(o.mp.id).catch((e) => console.error("refund: cancel subscription", o.id, e instanceof Error ? e.message : e));
      await setOrderMp(o.id, { ...o.mp, cancelled: true });
    }
    await recordIncome(o.wsName, `Reembolso · ${o.quote.label} · ${o.id}`, -Math.abs(p.transaction_amount), p.currency_id === "CLP" ? "CLP" : "USD").catch(() => null);
    return NextResponse.json({ ok: true, amount: p.transaction_amount, currency: p.currency_id, credits: g.credits });
  } catch (err) {
    console.error("reembolso", o.id, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: `Mercado Pago no aceptó el reembolso: ${err instanceof Error ? err.message.replace(/^Mercado Pago: /, "") : "error"}. Puedes hacerlo desde tu cuenta de Mercado Pago (Actividad → el pago → Devolver).` }, { status: 502 });
  }
}
