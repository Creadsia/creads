import { NextResponse } from "next/server";
import { updateOrder, orders } from "@/lib/billing";
import { getAuthorizedPayment, getPayment, getPreapproval, signatureOk } from "@/lib/mercadopago";
import { settleOrder } from "@/lib/settle";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Mercado Pago notifications (webhook). Nothing in the notification is trusted: we read the payment
// back from Mercado Pago with our own key and only then give credits. Answers 200 quickly; a 500
// makes Mercado Pago retry later.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const type = String(body?.type ?? body?.topic ?? url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "");
  const id = String(body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "");
  if (!/^[\w-]{1,64}$/.test(id)) return NextResponse.json({ ok: true, ignored: "sin id" });
  if (signatureOk(req, id) === false) console.warn("mercadopago: firma no coincide (se verifica igual con la API)", type, id);

  try {
    if (type === "payment") {
      const p = await getPayment(id);
      if (p.status !== "approved") return NextResponse.json({ ok: true, status: p.status });
      let orderId = p.external_reference ?? "";
      const pre = typeof p.metadata?.preapproval_id === "string" ? p.metadata.preapproval_id : "";
      if (!orderId && pre) orderId = (await getPreapproval(pre)).external_reference ?? "";
      if (!orderId) return NextResponse.json({ ok: true, ignored: "sin pedido" });
      return NextResponse.json(await settleOrder(orderId, { id: String(p.id), amount: p.transaction_amount, currency: p.currency_id }));
    }
    if (type === "subscription_authorized_payment") {
      const ap = await getAuthorizedPayment(id);
      if (!ap.payment || ap.payment.status !== "approved") return NextResponse.json({ ok: true, status: ap.payment?.status ?? ap.status });
      const pre = await getPreapproval(ap.preapproval_id);
      if (!pre.external_reference) return NextResponse.json({ ok: true, ignored: "sin pedido" });
      // same payment id as the "payment" notification: whichever comes first counts, the other is ignored
      const real = await getPayment(String(ap.payment.id));
      return NextResponse.json(await settleOrder(pre.external_reference, { id: String(real.id), amount: real.transaction_amount, currency: real.currency_id }));
    }
    if (type === "subscription_preapproval") {
      const pre = await getPreapproval(id);
      if (pre.status === "cancelled" && pre.external_reference) {
        const o = (await orders()).find((x) => x.id === pre.external_reference);
        if (o?.mp) await updateOrder(o.id, (x) => { if (x.mp) x.mp.cancelled = true; });
      }
      return NextResponse.json({ ok: true, status: pre.status });
    }
    return NextResponse.json({ ok: true, ignored: type || "tipo desconocido" });
  } catch (err) {
    console.error("mercadopago webhook", type, id, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "reintentar" }, { status: 500 });
  }
}

// Mercado Pago sometimes checks the address with GET.
export async function GET() {
  return NextResponse.json({ ok: true });
}
