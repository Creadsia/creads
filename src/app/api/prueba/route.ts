import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { getOrder } from "@/lib/billing";
import { PLANS, clpFor } from "@/lib/catalog";
import { mpReady } from "@/lib/mercadopago";
import { visitorFrom } from "@/lib/meta";
import { PRUEBA_DIAS, hasPaid, tarjetaObligatoria } from "@/lib/regalo";
import { PRUEBA_PLAN, activarPrueba, empezarPrueba, pruebaAbierta, tuvoPrueba } from "@/lib/prueba";
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
  const [paid, abierta, tuvo, rate] = await Promise.all([hasPaid(ws), pruebaAbierta(ws), tuvoPrueba(ws), usdClpRate().catch(() => 950)]);
  const plan = PLANS.find((p) => p.id === PRUEBA_PLAN)!;
  return NextResponse.json({
    activa: true, dias: PRUEBA_DIAS, plan: plan.name, clp: clpFor(plan.monthly, rate), usd: plan.monthly,
    estado: paid ? "pagado" : abierta ? "en-prueba" : tuvo ? "usada" : "sin-tarjeta", cobro: abierta?.mp?.trial ?? null,
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
    const r = await empezarPrueba({ ws, email: s.user.email }, visitorFrom(req));
    return NextResponse.json({ redirect: r.url });
  } catch (err) {
    console.error("prueba", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No se pudo abrir Mercado Pago. Intenta de nuevo o escríbenos a hola@creadsia.com." }, { status: 502 });
  }
}
