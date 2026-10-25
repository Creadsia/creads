import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { addOrder, fundadoresUsados, hasPaidBefore, ordersOf, packParaDescontar, setOrderMp, workspaceRow } from "@/lib/billing";
import { FUNDADOR, type ItemId, METHODS, type MethodId, PLANS, PRUEBA, PRUEBA_DESCUENTO_DIAS, type Period, clpFor, onSale, quote } from "@/lib/catalog";
import { usdClpRate } from "@/lib/usd-clp";
import { cancelarPrueba, pruebaAbierta } from "@/lib/prueba";
import { sendMeta, visitorFrom } from "@/lib/meta";
import { createPreference, createSubscription, getPreapproval, mpReady, oneTimeOnly } from "@/lib/mercadopago";
import { reconcileSubscription } from "@/lib/settle";
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
  if (ws === "main") return NextResponse.json({ online: mpReady(), renews: !oneTimeOnly(), owner: true, firstPurchase: true, discount: 0, usdClp: rate, orders: [], subscription: null });
  try {
    // a subscription charge whose notification was missed is picked up here (looked up at Mercado Pago, applied once)
    if (mpReady()) {
      const recent = (await ordersOf(ws).catch(() => [])).filter((o) => o.mp?.kind === "subscription" && !o.mp.cancelled && o.status !== "cancelado" && Date.now() - Date.parse(o.created) < 40 * 86_400_000).slice(0, 3);
      for (const o of recent) await reconcileSubscription(o.id).catch(() => 0);
    }
    const [w, paid, mine, usados] = await Promise.all([workspaceRow(ws), hasPaidBefore(ws), ordersOf(ws), fundadoresUsados()]);
    const pack = paid ? null : await packParaDescontar(ws, PRUEBA_DESCUENTO_DIAS);
    const sub = mine.find((o) => o.status === "pagado" && o.mp?.kind === "subscription" && !o.mp.cancelled);
    // the card trial counts as a subscription to cancel (before its first charge)
    const trial = sub ? null : mine.find((o) => o.mp?.trial && !o.mp.cancelled && o.status === "pendiente");
    const trialOn = trial?.mp ? (await getPreapproval(trial.mp.id).catch(() => null))?.status === "authorized" : false;
    return NextResponse.json({
      online: mpReady(), renews: !oneTimeOnly(), owner: false, firstPurchase: !paid, discount: Number(w.discount ?? 0), usdClp: rate,
      fundador: { quedan: paid ? 0 : Math.max(0, FUNDADOR.cupos - usados) }, packDescuento: pack?.usd ?? null,
      packComprado: mine.some((o) => o.item === PRUEBA.id && o.status === "pagado"),
      subscription: sub ? { id: sub.id, label: sub.quote.label } : trial && trialOn ? { id: trial.id, label: trial.quote.label, trial: trial.mp!.trial, clp: trial.mp!.clp } : null,
      orders: mine.filter((o) => o.status !== "reemplazado").slice(0, 10).map(({ id, item, period, method, quote: q, status, created }) => ({ id, item, period, method, total: q.total, label: q.label, status, created })),
    });
  } catch {
    return NextResponse.json({ online: mpReady(), renews: !oneTimeOnly(), owner: false, firstPurchase: true, discount: 0, usdClp: rate, orders: [], subscription: null });
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
    const [w, paid, rate, mine] = await Promise.all([workspaceRow(ws), hasPaidBefore(ws), usdClp(), ordersOf(ws)]);
    // one monthly subscription at a time: two would both charge the card every month
    const active = mine.find((o) => o.status === "pagado" && o.mp?.kind === "subscription" && !o.mp.cancelled);
    if (active && PLANS.some((p) => p.id === b?.item)) {
      return NextResponse.json({ error: `Ya tienes la renovación automática de ${active.quote.label}. Para cambiar de plan, primero cancela esa renovación aquí mismo (tu plan sigue activo hasta la fecha pagada) y luego elige el nuevo.` }, { status: 409 });
    }
    // top-ups add to an active plan: on their own they couldn't be used (an ended plan blocks jobs)
    // and would expire with the period that already ended
    if (b?.item === PRUEBA.id && mine.some((o) => o.item === PRUEBA.id && o.status === "pagado")) {
      return NextResponse.json({ error: "El Pack Prueba se compra una sola vez. Elige un plan para seguir creando (si lo haces dentro de 7 días, se descuenta lo que pagaste)." }, { status: 400 });
    }
    if (String(b?.item ?? "").startsWith("pack-") && b?.item !== PRUEBA.id && !(w.paid_until && w.paid_until >= new Date().toISOString().slice(0, 10))) {
      return NextResponse.json({ error: "Las recargas se suman a un plan activo. Elige primero un plan (o renueva el tuyo) y después suma segundos cuando los necesites." }, { status: 400 });
    }
    // buying a plan during the card trial: the trial's subscription is cancelled first (two would both charge)
    if (PLANS.some((p) => p.id === b?.item)) {
      const trial = await pruebaAbierta(ws);
      if (trial) await cancelarPrueba(trial);
    }
    const discountPct = Number(w.discount ?? 0);
    // retired plans (Ultra) and the annual payment can't be bought, even with an old link (audit 22 Oct 2026)
    if (!onSale(String(b?.item ?? "") as ItemId, period)) return NextResponse.json({ error: "Ese plan ya no está a la venta. Elige Testea, Escala o Agencia." }, { status: 400 });
    const isPlan = PLANS.some((p) => p.id === b?.item);
    // precio fundador: Escala monthly, first plan of this account, while there are places left (real counter)
    const fundador = isPlan && !paid && b?.item === FUNDADOR.plan && period === "mensual" && (await fundadoresUsados()) < FUNDADOR.cupos;
    // the Pack Prueba bought in the last 7 days comes off the first payment of the first plan
    const pack = isPlan && !paid ? await packParaDescontar(ws, PRUEBA_DESCUENTO_DIAS) : null;
    const q = quote(String(b?.item ?? "") as ItemId, period, { discountPct, firstPurchase: !paid, fundador, pack });
    if (!q) return NextResponse.json({ error: "Plan desconocido." }, { status: 400 });
    const visitor = visitorFrom(req);
    const order = await addOrder({ ws, wsName: w.name, email: s.user.email, item: q.item, period: q.period, method, quote: q, visitor });
    await sendMeta({ name: "InitiateCheckout", eventId: typeof b?.eventId === "string" ? b.eventId : undefined, email: s.user.email, value: q.total, content: q.label }, visitor);

    let redirect: string | null = null;
    if (method === "mercadopago" && mpReady()) {
      const clp = clpFor(q.total, rate);
      const title = `Creads IA · ${q.label}`;
      if (q.period === "mensual" && !oneTimeOnly()) {
        // monthly plan: subscription; the first charge may carry the launch offer
        const plan = PLANS.find((p) => p.id === q.item)!;
        const fullClp = clpFor(plan.monthly * (1 - discountPct / 100), rate);
        const midClp = q.fundador ? clpFor(FUNDADOR.usd * (1 - discountPct / 100), rate) : undefined;
        const sub = await createSubscription({ orderId: order.id, title, firstClp: clp, email: s.user.email });
        await setOrderMp(order.id, { kind: "subscription", id: sub.id, clp, fullClp, ...(midClp ? { midClp, promoMonths: FUNDADOR.months } : {}) });
        redirect = sub.url;
      } else {
        // the Pack Prueba bought from a batch comes back to that batch (only studio pages)
        const backPath = typeof b?.volver === "string" && /^\/app\/[a-z]+(\?id=t_[a-z0-9]{8,20})?$/.test(b.volver) ? b.volver : undefined;
        const pref = await createPreference({ orderId: order.id, title, clp, email: s.user.email, backPath });
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
