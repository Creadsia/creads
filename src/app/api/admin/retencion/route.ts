import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { readPrivateJSON, sbAll } from "@/lib/supabase";
import { PLANS } from "@/lib/catalog";
import { usdClpRate } from "@/lib/usd-clp";
import { DEFAULT_USD_PER_CREDIT } from "@/lib/credit-math";
import { dayCL } from "@/lib/stats";
import { type Leave, type OrderLite, type PayRow, avgTenureMonths, buildSpells, cohortRetention, mrrAt, activeAt, nextMonth, observedLtv, periodStats, reasonCounts, reasonOf } from "@/lib/retention";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET ?mes=YYYY-MM&meses=6|12&plan=starter|plus|studio (owner and partners only, like the rest of the Panel)
// → «Suscripciones y retención»: the chosen month, its history, plans, reasons, cohorts, LTV and acquisition.

const MONTH = /^\d{4}-\d{2}$/;
/** 00:00 of a Chile day, as an instant (Chile is UTC−3 or UTC−4 depending on the season). */
function chileMidnight(day: string) {
  for (const off of ["-03:00", "-04:00"]) {
    const t = Date.parse(`${day}T00:00:00${off}`);
    const h = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Santiago", hour: "2-digit", hourCycle: "h23" }).format(new Date(t));
    if (h === "00") return t;
  }
  return Date.parse(`${day}T00:00:00-03:00`);
}
const monthStart = (m: string) => chileMidnight(`${m}-01`);
const prevMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`; };

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const now = Date.now();
  const cur = dayCL().slice(0, 7);
  const mes = MONTH.test(q.get("mes") ?? "") && q.get("mes")! <= cur ? q.get("mes")! : cur;
  const meses = Math.min(24, Math.max(3, Number(q.get("meses")) || 6));
  const plan = PLANS.some((p) => p.id === q.get("plan")) ? q.get("plan")! : undefined;

  try {
    const [pays, orders, clients, leaves, rate] = await Promise.all([
      sbAll<PayRow>("payments?select=id,order_id,owner,amount,currency,created_at", "created_at.asc,id.asc"),
      sbAll<OrderLite>("orders?status=eq.pagado&select=id,owner,item,period,mp,visitor,created_at", "created_at.asc,id.asc"),
      sbAll<{ id: string }>("workspaces?kind=eq.client&select=id,created_at", "created_at.asc,id.asc"),
      readPrivateJSON<Leave[]>("cancelaciones.json").catch(() => null),
      usdClpRate().catch(() => 950),
    ]);
    // only real customers: Creadsia's own account and test workspaces never count
    const ok = new Set(clients.map((c) => c.id));
    const P = pays.filter((p) => ok.has(p.owner));
    const O = orders.filter((o) => ok.has(o.owner));
    const plans = PLANS.map((p) => ({ id: p.id, name: p.name, monthly: p.monthly, yearlyPerMonth: p.yearlyPerMonth }));
    const spells = buildSpells(P, O, plans, now);
    const toUsd = (a: number, c: string) => (c === "CLP" ? a / rate : a);

    // the chosen month and the ones before it
    const months: string[] = [];
    for (let m = mes, i = 0; i < meses; i++, m = prevMonth(m)) months.unshift(m);
    const inMonth = (iso: string, m: string) => { const t = Date.parse(iso); return t >= monthStart(m) && t < monthStart(nextMonth(m)); };
    const cobrado = (m: string) => Math.round(P.filter((p) => inMonth(p.created_at, m)).reduce((t, p) => t + toUsd(Number(p.amount) || 0, p.currency), 0) * 100) / 100;
    const L = (leaves ?? []).filter((l) => ok.has(l.ws));
    const solicitadas = (m: string) => L.filter((l) => inMonth(l.at, m) && (!plan || l.plan === plan)).length;
    const statsOf = (m: string, pl = plan) => {
      const end = Math.min(monthStart(nextMonth(m)), now + 1);
      return { mes: m, parcial: end <= now ? false : true, ...periodStats(spells, monthStart(m), end, pl), cobrado: cobrado(m), solicitadas: solicitadas(m) };
    };
    const historia = months.map((m) => statsOf(m));
    const actual = historia[historia.length - 1];
    const anterior = statsOf(prevMonth(mes));

    // right now
    const activas = spells.filter((s) => activeAt(s, now) && (!plan || s.stretches.some((x) => x.plan === plan)));
    const mrrHoy = Math.round(activas.reduce((t, s) => t + mrrAt(s, now), 0) * 100) / 100;

    // per plan, for the chosen month
    const porPlan = PLANS.filter((p) => !p.hidden || spells.some((s) => s.stretches.some((x) => x.plan === p.id))).map((p) => {
      const st = statsOf(mes, p.id);
      return { id: p.id, nombre: p.name, activos: st.activosFin, nuevos: st.nuevas + st.reactivaciones, perdidos: st.perdidos, churn: st.churn, mrr: st.mrrFin, mrrPerdido: st.mrrPerdido, permanencia: avgTenureMonths(spells, now, p.id), base: st.base };
    });

    // cancellation reasons: the chosen period and since the start
    const desde = monthStart(months[0]);
    const motivos = reasonCounts(L.filter((l) => Date.parse(l.at) >= desde && (!plan || l.plan === plan)));
    const comentarios = L.filter((l) => l.detail && Date.parse(l.at) >= desde).slice(-15).reverse().map((l) => ({ at: l.at, motivo: reasonOf(l.reason), plan: l.plan ?? null, texto: l.detail }));

    // LTV: observed (real money) and, only with enough history, estimated
    const planIds = new Set(PLANS.map((p) => p.id));
    const obs = observedLtv(P, O, planIds, toUsd);
    const closed = historia.filter((h) => !h.parcial && h.base >= 10 && h.churn != null);
    let estimado: { valor: number; margen: number; churnMedio: number; arpu: number } | null = null;
    if (closed.length >= 3) {
      const churnMedio = closed.reduce((t, h) => t + (h.churn ?? 0), 0) / closed.length / 100;
      const arpu = activas.length ? mrrHoy / activas.length : 0;
      // margin per US$ of plan if the customer used all their seconds: price − IVA − Mercado Pago (≈4%) − AI cost
      const margins = PLANS.filter((p) => !p.hidden).map((p) => { const net = p.monthly / 1.19 - p.monthly * 0.04; return (net - p.credits * DEFAULT_USD_PER_CREDIT) / p.monthly; });
      const margen = margins.reduce((a, b) => a + b, 0) / margins.length;
      if (churnMedio > 0 && arpu > 0) estimado = { valor: Math.round(((arpu * margen) / churnMedio) * 100) / 100, margen: Math.round(margen * 1000) / 10, churnMedio: Math.round(churnMedio * 1000) / 10, arpu: Math.round(arpu * 100) / 100 };
    }
    // cumulative money per customer by cohort (month of first plan charge)
    const firstOf = new Map<string, string>();
    for (const s of [...spells].sort((a, b) => a.start - b.start)) if (!firstOf.has(s.owner)) firstOf.set(s.owner, dayCL(new Date(s.start)).slice(0, 7));
    const ltvCohortes = months.map((m) => {
      const members = [...firstOf.entries()].filter(([, c]) => c === m).map(([o]) => o);
      const total = members.reduce((t, o) => t + (obs.perOwner.get(o) ?? 0), 0);
      return { mes: m, clientes: members.length, porCliente: members.length ? Math.round((total / members.length) * 100) / 100 : null };
    });

    // acquisition: by channel and campaign (only when it was recorded; never guessed)
    const groups = new Map<string, { fuente: string; campana: string | null; clientes: Set<string>; activos: Set<string>; perdidos: Set<string>; meses: number[] }>();
    for (const s of spells) {
      const key = `${s.source ?? "sin dato"}|${s.campaign ?? ""}`;
      const g = groups.get(key) ?? { fuente: s.source ?? "Sin dato de origen", campana: s.campaign, clientes: new Set(), activos: new Set(), perdidos: new Set(), meses: [] };
      g.clientes.add(s.owner);
      if (activeAt(s, now)) g.activos.add(s.owner); else if (s.churnAt != null) g.perdidos.add(s.owner);
      g.meses.push(((s.churnAt ?? now) - s.start) / 86_400_000 / 30.44);
      groups.set(key, g);
    }
    const adquisicion = [...groups.values()].map((g) => {
      const ingresos = [...g.clientes].reduce((t, o) => t + (obs.perOwner.get(o) ?? 0), 0);
      return {
        fuente: g.fuente, campana: g.campana, clientes: g.clientes.size, activos: g.activos.size, perdidos: g.perdidos.size,
        churn: g.clientes.size ? Math.round((g.perdidos.size / g.clientes.size) * 1000) / 10 : null,
        permanencia: Math.round((g.meses.reduce((a, b) => a + b, 0) / g.meses.length) * 10) / 10,
        ingresos: Math.round(ingresos * 100) / 100, ltv: g.clientes.size ? Math.round((ingresos / g.clientes.size) * 100) / 100 : null,
        cac: null as number | null, // needs Meta's spend per campaign (connect Meta and tag the ads with utm_campaign)
      };
    }).sort((a, b) => b.clientes - a.clientes);

    return NextResponse.json({
      mes, meses, plan: plan ?? null, updated: new Date().toISOString(), tasaClp: rate,
      hoy: { activas: activas.length, mrr: mrrHoy, enGracia: activas.filter((s) => s.end < now).length },
      actual, anterior, historia, porPlan, motivos, comentarios,
      permanencia: avgTenureMonths(spells, now, plan),
      cohortes: cohortRetention(spells, months, monthStart, now),
      ltv: { observado: obs.porCliente, clientes: obs.clientes, total: obs.total, estimado, cohortes: ltvCohortes },
      adquisicion,
      reembolsos: "Los reembolsos aún no se registran en el sistema: si devuelves un pago, anótalo en Movimientos.",
    });
  } catch (err) {
    const missing = Boolean((err as { missing?: boolean })?.missing);
    return NextResponse.json({ error: missing ? "Falta activar los pagos en la base de datos." : "No se pudieron leer las suscripciones." }, { status: 502 });
  }
}
