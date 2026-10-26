import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { fundadoresUsados, getOrder } from "@/lib/billing";
import { FUNDADOR } from "@/lib/catalog";
import { clpFor } from "@/lib/catalog";
import { unlimited } from "@/lib/credits";
import { mpReady } from "@/lib/mercadopago";
import { visitorFrom } from "@/lib/meta";
import { bloqueaPorTarjeta, hasPaid, regaloDado, tarjetaObligatoria } from "@/lib/regalo";
import { activarPrueba, empezarPrueba, empezarPruebaConTarjeta, planDePrueba, planPrueba, pruebaAbierta, resumenPrueba, tuvoPrueba } from "@/lib/prueba";
import { usdClpRate } from "@/lib/usd-clp";

export const dynamic = "force-dynamic";

// «Prueba gratis con tarjeta»: GET says whether it applies to this account and what will be charged;
// POST {} opens Mercado Pago to add the card; POST {pedido} checks the card on the way back.
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const on = tarjetaObligatoria() && mpReady();
  const ws = s.user.workspace;
  if (!on || unlimited(ws)) return NextResponse.json({ activa: false });
  const [paid, abierta, tuvo, dadoAntes, rate] = await Promise.all([hasPaid(ws), pruebaAbierta(ws), tuvoPrueba(ws), regaloDado(ws), usdClpRate().catch(() => 950)]);
  let dado = dadoAntes;
  // a card already accepted whose gift didn't load yet (webhook late, page closed on the way back): load it now
  if (!paid && !dado && abierta) dado = (await activarPrueba(abierta).catch(() => null)) === "ok" && (await regaloDado(ws));
  const r = resumenPrueba(new URL(req.url).searchParams.get("plan") ?? undefined);
  // the lock rule (lib/oferta.ts bloqueaPorTarjeta): never paid and never got the gift = add the card first
  const bloqueo = bloqueaPorTarjeta({ trialOn: on, unlimited: unlimited(ws), paid, giftGiven: dado });
  return NextResponse.json({
    activa: true, ...r, clp: clpFor(r.usd, rate),
    estado: paid ? "pagado" : bloqueo ? "sin-tarjeta" : abierta ? "en-prueba" : tuvo ? "usada" : "regalo-previo", cobro: abierta?.mp?.trial ?? null,
  });
}

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("heavy", s.user.id);
  if (limited) return limited;
  if (!tarjetaObligatoria() || !mpReady()) return NextResponse.json({ error: "La prueba con tarjeta no está activa." }, { status: 400 });
  const ws = s.user.workspace;
  if (unlimited(ws)) return NextResponse.json({ error: "Esta es la vista de cliente." }, { status: 400 });
  const b = await req.json().catch(() => null);
  // the plan chosen at /empezar (Testea by default); the founder price while places are left, as /api/pagos
  const plan = planDePrueba(typeof b?.plan === "string" ? b.plan : undefined);
  const opciones = { plan, fundador: plan === FUNDADOR.plan && (await fundadoresUsados().catch(() => FUNDADOR.cupos)) < FUNDADOR.cupos };
  try {
    if (typeof b?.pedido === "string") {
      const o = await getOrder(b.pedido).catch(() => null);
      if (!o || o.ws !== ws) return NextResponse.json({ error: "No encontré tu prueba." }, { status: 404 });
      // order + plan price travel back so the browser fires StartTrial with the same event_id and predicted_ltv
      return NextResponse.json({ estado: await activarPrueba(o), order: o.id, usd: planPrueba(o.item).usd });
    }
    if (await hasPaid(ws)) return NextResponse.json({ error: "Tu cuenta ya tiene un plan." }, { status: 409 });
    const abierta = await pruebaAbierta(ws);
    if (abierta && (await activarPrueba(abierta)) === "ok") return NextResponse.json({ error: "Tu prueba ya está activa." }, { status: 409 });
    if (!abierta && (await tuvoPrueba(ws))) return NextResponse.json({ error: "Ya usaste tu prueba gratis. Elige un plan para seguir.", planes: true }, { status: 409 });
    // the card typed inside Creads (Mercado Pago's secure fields): authorized here, no leaving the page
    if (typeof b?.card_token === "string" && /^[\w-]{16,64}$/.test(b.card_token)) {
      if (abierta) await import("@/lib/prueba").then((m) => m.cancelarPrueba(abierta)).catch(() => null);
      const r = await empezarPruebaConTarjeta({ ws, email: s.user.email }, b.card_token, visitorFrom(req), opciones).catch((e) => {
        console.error("prueba tarjeta", e instanceof Error ? e.message : e);
        return { estado: "error" as const, order: "" };
      });
      if (r.estado === "ok") return NextResponse.json({ estado: "ok", order: r.order, usd: planPrueba(plan).usd });
      return NextResponse.json({ error: r.estado === "error" ? "Mercado Pago no aceptó esa tarjeta. Revisa los datos o prueba con otra." : "Mercado Pago está revisando tu tarjeta: espera unos segundos y recarga." }, { status: r.estado === "error" ? 402 : 202 });
    }
    const r = await empezarPrueba({ ws, email: s.user.email }, visitorFrom(req), opciones);
    return NextResponse.json({ redirect: r.url });
  } catch (err) {
    console.error("prueba", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No se pudo abrir Mercado Pago. Intenta de nuevo o escríbenos a hola@creadsia.com." }, { status: 502 });
  }
}
