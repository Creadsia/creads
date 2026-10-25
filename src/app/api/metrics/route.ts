import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sbAll } from "@/lib/supabase";
import { PLANS } from "@/lib/catalog";
import { type Range, type StatRow, addDays, dayCL, dayList } from "@/lib/stats";

export const dynamic = "force-dynamic";

// Read-only numbers for the owner's outside agents (e.g. his «CEO General» on Grok), so they quote exact
// figures instead of guesses. Only aggregates: no emails, names or ids of customers ever leave here.
// Access: METRICS_TOKEN (Vercel env, 24+ chars) as `Authorization: Bearer <token>` or `?token=` for agents
// that can only open a URL. Days are Chile days (America/Santiago). Money as paid, per currency.

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const h = (s: string) => createHash("sha256").update(s).digest();

function allowed(req: Request) {
  const secret = process.env.METRICS_TOKEN ?? "";
  if (secret.length < 24) return false;
  const auth = req.headers.get("authorization") ?? "";
  const got = auth.startsWith("Bearer ") ? auth.slice(7).trim() : (new URL(req.url).searchParams.get("token") ?? "");
  return got.length > 0 && timingSafeEqual(h(got), h(secret));
}

interface Order { status: string; item: string; mp: { kind?: string; trial?: string; cancelled?: boolean } | null; created_at: string; closed_at: string | null }
interface Pay { amount: number; currency: string; created_at: string }
interface Credit { delta: number; kind: string; note: string | null; ref: string | null; created_at: string }
interface Clip { status: string; kind: string | null; created_at: string }
interface Ws { id: string; plan: string | null; paid_until: string | null; active: boolean; created_at: string }

const iso = (d: string) => new Date(Date.parse(`${d}T00:00:00-04:00`) - 86400_000).toISOString(); // a day early covers DST

export async function GET(req: Request) {
  if (!allowed(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const today = dayCL();
  const days = Math.min(92, Math.max(1, Number(q.get("days")) || 30));
  let r: Range = { from: q.get("from") ?? addDays(today, -(days - 1)), to: q.get("to") ?? today };
  if (r.to > today) r.to = today;
  if (!DAY.test(r.from) || !DAY.test(r.to) || r.from > r.to || dayList(r).length > 366) r = { from: addDays(today, -29), to: today };
  const since = iso(r.from);
  const inR = (ts: string) => { const d = dayCL(new Date(ts)); return d >= r.from && d <= r.to ? d : null; };

  try {
    const [ws, orders, pays, credits, clips, images, stats] = await Promise.all([
      sbAll<Ws>("workspaces?kind=eq.client&select=id,plan,paid_until,active,created_at", "created_at.asc,id.asc"),
      sbAll<Order>(`orders?or=(created_at.gte.${since},closed_at.gte.${since},status.eq.pendiente)&select=status,item,mp,created_at,closed_at`, "created_at.asc,id.asc"),
      sbAll<Pay>(`payments?created_at=gte.${since}&select=amount,currency,created_at`, "created_at.asc,id.asc").catch(() => [] as Pay[]),
      sbAll<Credit>(`credits?created_at=gte.${since}&or=(kind.in.(charge,refund,plan,topup),ref.like.regalo:*)&select=delta,kind,note,ref,created_at`, "created_at.asc,id.asc"),
      sbAll<Clip>(`clips?created_at=gte.${since}&status=neq.pending&select=status,kind,created_at`, "created_at.asc,id.asc"),
      sbAll<{ created_at: string }>(`images?created_at=gte.${since}&select=created_at`, "created_at.asc,id.asc").catch(() => []),
      sbAll<StatRow>(`site_stats?day=gte.${r.from}&day=lte.${r.to}&dim=eq.ses&key=eq.all&select=day,dim,key,n`, "day.asc,dim.asc,key.asc").catch(() => [] as StatRow[]),
    ]);
    const blank = () => ({
      visitas: 0, registros: 0, tarjetas_agregadas: 0, regalos_sin_tarjeta: 0, pruebas_canceladas: 0,
      checkouts_iniciados: 0, pagos_aprobados: 0, ingresos: {} as Record<string, number>,
      creditos_usados: 0, creditos_devueltos: 0,
      videos_generados: 0, videos_fallidos: 0, imagenes_generadas: 0,
    });
    const byDay = new Map(dayList(r).map((d) => [d, { dia: d, ...blank() }]));
    const at = (ts: string | null) => (ts ? byDay.get(inR(ts) ?? "") : undefined);

    for (const s of stats) { const d = byDay.get(s.day); if (d) d.visitas += s.n; }
    for (const w of ws) { const d = at(w.created_at); if (d) d.registros++; }
    for (const c of credits) {
      const d = at(c.created_at); if (!d) continue;
      if (c.ref?.startsWith("regalo:")) { if (/tarjeta/i.test(c.note ?? "")) d.tarjetas_agregadas++; else d.regalos_sin_tarjeta++; }
      else if (c.kind === "charge") d.creditos_usados += Math.abs(Number(c.delta) || 0);
      else if (c.kind === "refund") d.creditos_devueltos += Math.abs(Number(c.delta) || 0);
    }
    for (const o of orders) {
      if (o.mp?.trial) { if (o.mp.cancelled) { const d = at(o.closed_at ?? o.created_at); if (d) d.pruebas_canceladas++; } continue; }
      const d = at(o.created_at); if (d) d.checkouts_iniciados++;
    }
    for (const p of pays) {
      const d = at(p.created_at); if (!d) continue;
      d.pagos_aprobados++;
      const cur = (p.currency || "USD").toUpperCase();
      d.ingresos[cur] = Math.round(((d.ingresos[cur] ?? 0) + Number(p.amount || 0)) * 100) / 100;
    }
    for (const c of clips) {
      const d = at(c.created_at); if (!d || c.kind === "gen:image") continue;
      d.videos_generados++; if (c.status === "failed") d.videos_fallidos++;
    }
    for (const c of clips) { if (c.kind === "gen:image") { const d = at(c.created_at); if (d) d.imagenes_generadas++; } }
    for (const i of images) { const d = at(i.created_at); if (d) d.imagenes_generadas++; }

    const diario = [...byDay.values()];
    const total = blank();
    for (const d of diario) for (const k of Object.keys(total) as (keyof typeof total)[]) {
      if (k === "ingresos") for (const [c, n] of Object.entries(d.ingresos)) total.ingresos[c] = Math.round(((total.ingresos[c] ?? 0) + n) * 100) / 100;
      else (total[k] as number) += d[k] as number;
    }

    // Right now (not per day): who is paying, who is in the free trial and what the plans add up to per month.
    const pagando = ws.filter((w) => w.active && w.plan && w.paid_until && w.paid_until >= today);
    const porPlan: Record<string, number> = {};
    for (const w of pagando) porPlan[w.plan!] = (porPlan[w.plan!] ?? 0) + 1;
    const mrrUsd = pagando.reduce((a, w) => a + (PLANS.find((p) => p.id === w.plan)?.monthly ?? 0), 0);
    const pruebasAbiertas = orders.filter((o) => o.status === "pendiente" && o.mp?.trial && !o.mp.cancelled && o.mp.trial >= today).length;

    return NextResponse.json({
      actualizado: new Date().toISOString(), zona: "America/Santiago", rango: r,
      ahora: {
        cuentas_totales: ws.length,
        suscripciones_activas: pagando.length,
        por_plan: porPlan,
        mrr_usd_estimado: Math.round(mrrUsd * 100) / 100,
        pruebas_gratis_abiertas: pruebasAbiertas,
      },
      total, diario,
      notas: {
        tarjetas_agregadas: "Cuentas que pusieron la tarjeta y empezaron la prueba gratis de 7 días.",
        checkouts_iniciados: "Pedidos de plan o créditos creados (no incluye las pruebas gratis).",
        ingresos: "Lo cobrado por Mercado Pago, separado por moneda.",
        mrr_usd_estimado: "Suma del precio mensual en US$ de los planes vigentes.",
      },
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudieron leer las métricas." }, { status: 502 });
  }
}
