import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sbAll } from "@/lib/supabase";
import { PLANS } from "@/lib/catalog";
import { recentErrors } from "@/lib/errlog";
import { leerEventos } from "@/lib/eventos";
import { origins } from "@/lib/leads";
import { libroDe, listAfiliados } from "@/lib/afiliados";
import { type Range, type StatRow, addDays, dayCL, dayList } from "@/lib/stats";

export const dynamic = "force-dynamic";

// Read-only numbers for the owner's outside agents (e.g. his «CEO General» on Grok), so they quote exact
// figures instead of guesses. By default only aggregates; `?detalle=1` (owner, 25 Oct 2026: «Grok es mío»)
// adds every account with its email, every order, each model's failures and the recent platform errors.
// Always read-only: nothing here writes. Access: METRICS_TOKEN (Vercel env, 24+ chars) as `Authorization: Bearer <token>` or `?token=` for agents
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
    const eventos = await leerEventos(r.from, r.to).catch(() => []);
    const blank = () => ({
      visitas: 0, registros: 0, activaciones: 0, tarjetas_agregadas: 0, regalos_sin_tarjeta: 0, pruebas_canceladas: 0,
      checkouts_iniciados: 0, pagos_aprobados: 0, pagos_fallidos: 0, bajas: 0, ingresos: {} as Record<string, number>,
      creditos_usados: 0, creditos_devueltos: 0,
      videos_generados: 0, videos_fallidos: 0, imagenes_generadas: 0,
    });
    const byDay = new Map(dayList(r).map((d) => [d, { dia: d, ...blank() }]));
    const at = (ts: string | null) => (ts ? byDay.get(inR(ts) ?? "") : undefined);

    for (const s of stats) { const d = byDay.get(s.day); if (d) d.visitas += s.n; }
    for (const e of eventos) {
      const d = at(e.fecha); if (!d) continue;
      if (e.evento === "primera_generacion") d.activaciones++;
      else if (e.evento === "pago_fallido") d.pagos_fallidos++;
      else if (e.evento === "baja") d.bajas++;
    }
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
    const mrrUsd = pagando.reduce((a, w) => a + (PLANS.find((p) => p.id === w.plan || p.name === w.plan)?.monthly ?? 0), 0);
    const pruebasAbiertas = orders.filter((o) => o.status === "pendiente" && o.mp?.trial && !o.mp.cancelled && o.mp.trial >= today).length;

    const detalle = q.get("detalle") === "1" ? await detail(r, since, ws, orders, today).catch(() => ({ error: "No se pudo leer el detalle." })) : undefined;

    return NextResponse.json({
      actualizado: new Date().toISOString(), zona: "America/Santiago", rango: r,
      ahora: {
        cuentas_totales: ws.length,
        suscripciones_activas: pagando.length,
        por_plan: porPlan,
        mrr_usd_estimado: Math.round(mrrUsd * 100) / 100,
        pruebas_gratis_abiertas: pruebasAbiertas,
      },
      total, diario, ...(detalle ? { detalle } : {}),
      notas: {
        tarjetas_agregadas: "Cuentas que pusieron la tarjeta y empezaron la prueba gratis de 7 días.",
        checkouts_iniciados: "Pedidos de plan o créditos creados (no incluye las pruebas gratis).",
        activaciones: "Cuentas que hicieron su primera generación (desde el 25 oct 2026).",
        pagos_fallidos: "Pagos rechazados por Mercado Pago, también renovaciones (desde el 25 oct 2026).",
        bajas: "Suscripciones canceladas, desde Creads o desde Mercado Pago (desde el 25 oct 2026).",
        ingresos: "Lo cobrado por Mercado Pago, separado por moneda.",
        mrr_usd_estimado: "Suma del precio mensual en US$ de los planes vigentes.",
      },
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudieron leer las métricas." }, { status: 502 });
  }
}

interface OrderFull { id: string; owner: string; email: string; item: string; status: string; quote: { label?: string; total?: number } | null; mp: { kind?: string; trial?: string; cancelled?: boolean; clp?: number } | null; visitor: { src?: string } | null; created_at: string; closed_at: string | null }

/** Everything per account and per order, plus where generations fail. Read-only. */
async function detail(r: Range, since: string, ws: Ws[], _orders: Order[], today: string) {
  const [org, afis] = await Promise.all([origins().catch(() => ({} as Awaited<ReturnType<typeof origins>>)), listAfiliados().catch(() => [])]);
  const afiDe = new Map<string, string>();
  for (const a of afis) for (const ref of (await libroDe(a.code).catch(() => null))?.referidos ?? []) afiDe.set((ref as { ws: string }).ws, a.code);
  const [users, orders, credits, pays, clips, errores, wsNames] = await Promise.all([
    sbAll<{ email: string; name: string | null; workspace: string; role: string; last_login: string | null }>("users?select=email,name,workspace,role,last_login", "created_at.asc,id.asc"),
    sbAll<OrderFull>("orders?select=id,owner,email,item,status,quote,mp,visitor,created_at,closed_at", "created_at.asc,id.asc"),
    sbAll<{ owner: string; delta: number; kind: string; ref: string | null; note: string | null }>("credits?select=owner,delta,kind,ref,note", "created_at.asc,id.asc"),
    sbAll<{ owner: string; amount: number; currency: string }>("payments?select=owner,amount,currency", "created_at.asc,id.asc").catch(() => []),
    sbAll<{ owner: string; status: string; kind: string | null; model: string | null; error: string | null; usd: number | null; created_at: string }>(`clips?created_at=gte.${since}&status=neq.pending&select=owner,status,kind,model,error,usd,created_at`, "created_at.asc,id.asc"),
    recentErrors(1).catch(() => []),
    sbAll<{ id: string; name: string; discount: number; access: string }>("workspaces?kind=eq.client&select=id,name,discount,access", "created_at.asc,id.asc"),
  ]);
  const name = new Map(wsNames.map((w) => [w.id, w]));
  const per = <T,>(rows: T[], key: (x: T) => string) => { const m = new Map<string, T[]>(); for (const x of rows) m.set(key(x), [...(m.get(key(x)) ?? []), x]); return m; };
  const uBy = per(users, (u) => u.workspace), oBy = per(orders, (o) => o.owner), cBy = per(credits, (c) => c.owner), pBy = per(pays, (p) => p.owner), clBy = per(clips, (c) => c.owner);

  const cuentas = ws.map((w) => {
    const us = uBy.get(w.id) ?? [], os = oBy.get(w.id) ?? [], cs = cBy.get(w.id) ?? [], ps = pBy.get(w.id) ?? [], cl = clBy.get(w.id) ?? [];
    const regalo = cs.find((c) => c.ref === `regalo:${w.id}`);
    const prueba = os.find((o) => o.mp?.trial);
    const pagado: Record<string, number> = {};
    for (const p of ps) { const c = (p.currency || "USD").toUpperCase(); pagado[c] = Math.round(((pagado[c] ?? 0) + Number(p.amount || 0)) * 100) / 100; }
    return {
      cuenta: w.id, nombre: name.get(w.id)?.name ?? "", correos: us.map((u) => u.email),
      registro: w.created_at, ultimo_ingreso: us.map((u) => u.last_login).filter(Boolean).sort().pop() ?? null,
      fuente: org[w.id]?.src ?? os.find((o) => o.visitor?.src)?.visitor?.src ?? null,
      campana: org[w.id]?.camp ?? null,
      afiliado: afiDe.get(w.id) ?? null,
      plan: w.plan, pagado_hasta: w.paid_until, plan_vigente: Boolean(w.active && w.plan && w.paid_until && w.paid_until >= today), activa: w.active,
      descuento: name.get(w.id)?.discount ?? 0, acceso: name.get(w.id)?.access ?? "full",
      tarjeta: prueba ? (prueba.mp?.cancelled ? "prueba cancelada" : regalo ? "prueba activa o terminada" : "pidió prueba, sin tarjeta confirmada") : "no",
      cobro_prueba: prueba?.mp?.trial ?? null,
      regalo: regalo ? (/tarjeta/i.test(regalo.note ?? "") ? "con tarjeta" : "sin tarjeta") : "no",
      saldo_creditos: cs.reduce((a, c) => a + Number(c.delta || 0), 0),
      creditos_usados: cs.filter((c) => c.kind === "charge").reduce((a, c) => a + Math.abs(Number(c.delta) || 0), 0),
      pagos: ps.length, total_pagado: pagado,
      videos_en_rango: cl.length, fallidos_en_rango: cl.filter((c) => c.status === "failed").length,
    };
  }).sort((a, b) => b.registro.localeCompare(a.registro));

  const pedidos = orders.filter((o) => { const d = dayCL(new Date(o.created_at)); return d >= r.from && d <= r.to; }).map((o) => ({
    pedido: o.id, cuenta: o.owner, correo: o.email, que: o.quote?.label ?? o.item, estado: o.status,
    total_usd: Number(o.quote?.total) || 0, clp: o.mp?.clp ?? null, prueba: o.mp?.trial ? { cobro: o.mp.trial, cancelada: Boolean(o.mp.cancelled) } : null,
    fuente: o.visitor?.src ?? null, creado: o.created_at, cerrado: o.closed_at,
  })).reverse();

  const modelos = new Map<string, { modelo: string; tipo: string; total: number; fallidos: number; costo_usd: number; costo_fallidos_usd: number; errores: Map<string, number> }>();
  for (const c of clips) {
    const tipo = c.kind === "gen:image" ? "imagen" : c.kind?.startsWith("tool:") ? "herramienta" : "video";
    const k = `${tipo}|${c.model ?? "?"}`;
    const m = modelos.get(k) ?? { modelo: c.model ?? "?", tipo, total: 0, fallidos: 0, costo_usd: 0, costo_fallidos_usd: 0, errores: new Map() };
    m.total++; m.costo_usd += Number(c.usd || 0);
    if (c.status === "failed") { m.fallidos++; m.costo_fallidos_usd += Number(c.usd || 0); const e = (c.error ?? "sin detalle").slice(0, 120); m.errores.set(e, (m.errores.get(e) ?? 0) + 1); }
    modelos.set(k, m);
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  // credits used in the range, by the account's plan, and signups/payers by source
  const planDe = new Map(ws.map((w) => [w.id, w.plan ?? "sin plan"]));
  const usadoRango = await sbAll<{ owner: string; delta: number }>(`credits?kind=eq.charge&created_at=gte.${since}&select=owner,delta`, "created_at.asc,id.asc").catch(() => []);
  const consumo: Record<string, { cuentas: number; creditos: number; promedio_por_cuenta: number }> = {};
  const porCuenta = new Map<string, number>();
  for (const c of usadoRango) if (planDe.has(c.owner)) porCuenta.set(c.owner, (porCuenta.get(c.owner) ?? 0) + Math.abs(Number(c.delta) || 0));
  for (const [w, n] of porCuenta) { const k = planDe.get(w)!; const x = consumo[k] ?? { cuentas: 0, creditos: 0, promedio_por_cuenta: 0 }; x.cuentas++; x.creditos += n; consumo[k] = x; }
  for (const x of Object.values(consumo)) x.promedio_por_cuenta = x.cuentas ? Math.round(x.creditos / x.cuentas) : 0;
  const porFuente: Record<string, { cuentas: number; pagan: number }> = {};
  for (const c of cuentas) { const k = c.afiliado ? `afiliado:${c.afiliado}` : c.fuente ?? "sin dato"; const x = porFuente[k] ?? { cuentas: 0, pagan: 0 }; x.cuentas++; if (c.pagos > 0) x.pagan++; porFuente[k] = x; }
  return {
    consumo_por_plan: consumo, por_fuente: porFuente,
    cuentas, pedidos,
    modelos: [...modelos.values()].sort((a, b) => b.total - a.total).map((m) => ({
      modelo: m.modelo, tipo: m.tipo, total: m.total, fallidos: m.fallidos, tasa_falla: m.total ? r2(m.fallidos / m.total) : 0,
      costo_usd: r2(m.costo_usd), costo_fallidos_usd: r2(m.costo_fallidos_usd),
      errores_frecuentes: [...m.errores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([error, veces]) => ({ error, veces })),
    })),
    errores_24h: errores.slice(0, 50).map((e) => ({ cuando: e.at, area: e.area, mensaje: e.message, veces: e.n ?? 1, pagina: e.path ?? null, cuenta: e.ws ?? null })),
  };
}
