import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { getOrder } from "@/lib/billing";
import { PLANS, clpFor } from "@/lib/catalog";
import { mpReady } from "@/lib/mercadopago";
import { visitorFrom } from "@/lib/meta";
import { PRUEBA_DIAS, hasPaid, regaloDado, tarjetaObligatoria } from "@/lib/regalo";
import { PRUEBA_PLAN, activarPrueba, empezarPrueba, empezarPruebaConTarjeta, pruebaAbierta, tuvoPrueba } from "@/lib/prueba";
import { usdClpRate } from "@/lib/usd-clp";

export const dynamic = "force-dynamic";

// «Prueba gratis con tarjeta»: GET says whether it applies to this account and what will be charged;
// POST {} opens Mercado Pago to add the card; POST {pedido} checks the card on the way back.
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const on = tarjetaObligatoria() && mpReady();
  if (!on || s.user.workspace === "main") return NextResponse.json({ activa: false });
  const ws = s.user.workspace;
  const [paid, abierta, tuvo, dado, rate] = await Promise.all([hasPaid(ws), pruebaAbierta(ws), tuvoPrueba(ws), regaloDado(ws), usdClpRate().catch(() => 950)]);
  const plan = PLANS.find((p) => p.id === PRUEBA_PLAN)!;
  return NextResponse.json({
    activa: true, dias: PRUEBA_DIAS, plan: plan.name, clp: clpFor(plan.monthly, rate), usd: plan.monthly,
    // the gift only loads with the card: no gift = no card yet (accounts from before the card trial keep their gift)
    estado: paid ? "pagado" : !dado ? "sin-tarjeta" : abierta ? "en-prueba" : tuvo ? "usada" : "regalo-previo", cobro: abierta?.mp?.trial ?? null,
  });
}

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("heavy", s.user.id);
  if (limited) return limited;
  if (!tarjetaObligatoria() || !mpReady()) return NextResponse.json({ error: "La prueba con tarjeta no está activa." }, { status: 400 });
  const ws = s.user.workspace;
  if (ws === "main") return NextResponse.json({ error: "Esta es la vista de cliente." }, { status: 400 });
  const b = await req.json().catch(() => null);
  try {
    if (typeof b?.pedido === "string") {
      const o = await getOrder(b.pedido).catch(() => null);
      if (!o || o.ws !== ws) return NextResponse.json({ error: "No encontré tu prueba." }, { status: 404 });
      return NextResponse.json({ estado: await activarPrueba(o) });
    }
    if (await hasPaid(ws)) return NextResponse.json({ error: "Tu cuenta ya tiene un plan." }, { status: 409 });
    const abierta = await pruebaAbierta(ws);
    if (abierta && (await activarPrueba(abierta)) === "ok") return NextResponse.json({ error: "Tu prueba ya está activa." }, { status: 409 });
    if (!abierta && (await tuvoPrueba(ws))) return NextResponse.json({ error: "Ya usaste tu prueba gratis. Elige un plan para seguir.", planes: true }, { status: 409 });
    // the card typed inside Creads (Mercado Pago's secure fields): authorized here, no leaving the page
    if (typeof b?.card_token === "string" && /^[\w-]{16,64}$/.test(b.card_token)) {
      if (abierta) await import("@/lib/prueba").then((m) => m.cancelarPrueba(abierta)).catch(() => null);
      const estado = await empezarPruebaConTarjeta({ ws, email: s.user.email }, b.card_token, visitorFrom(req)).catch((e) => {
        console.error("prueba tarjeta", e instanceof Error ? e.message : e);
        return "error" as const;
      });
      if (estado === "ok") return NextResponse.json({ estado });
      return NextResponse.json({ error: estado === "error" ? "Mercado Pago no aceptó esa tarjeta. Revisa los datos o prueba con otra." : "Mercado Pago está revisando tu tarjeta: espera unos segundos y recarga." }, { status: estado === "error" ? 402 : 202 });
    }
    const r = await empezarPrueba({ ws, email: s.user.email }, visitorFrom(req));
    return NextResponse.json({ redirect: r.url });
  } catch (err) {
    console.error("prueba", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No se pudo abrir Mercado Pago. Intenta de nuevo o escríbenos a hola@creadsia.com." }, { status: 502 });
  }
}
