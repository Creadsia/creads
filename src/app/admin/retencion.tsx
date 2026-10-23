"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DesdeCero from "./desde-cero";

// Panel → Ventas y finanzas → Suscripciones y retención (owner, 22 Oct 2026): how long customers stay, how much
// recurring money comes and goes, and why they cancel. Data: /api/admin/retencion (rebuilt from the payment
// history, see lib/retention.ts). «Sin datos suficientes» whenever a number can't be trusted yet.

interface Month {
  mes: string; parcial: boolean; base: number; activosFin: number; nuevas: number; reactivaciones: number; renovaciones: number; perdidos: number; canceladasEfectivas: number;
  churn: number | null; retencion: number | null; mrrInicio: number; mrrFin: number; mrrPerdido: number; mrrContraccion: number; mrrExpansion: number; mrrNuevo: number;
  grossRevenueChurn: number | null; nrr: number | null; cobrado: number; solicitadas: number;
}
interface Data {
  mes: string; meses: number; plan: string | null; updated: string;
  hoy: { activas: number; mrr: number; enGracia: number };
  actual: Month; anterior: Month; historia: Month[];
  porPlan: { id: string; nombre: string; activos: number; nuevos: number; perdidos: number; churn: number | null; mrr: number; mrrPerdido: number; permanencia: number | null; base: number }[];
  motivos: { motivo: string; n: number }[];
  comentarios: { at: string; motivo: string; plan: string | null; texto: string }[];
  permanencia: number | null;
  cohortes: { month: string; size: number; cells: (number | null)[] }[];
  ltv: { observado: number | null; clientes: number; total: number; estimado: { valor: number; margen: number; churnMedio: number; arpu: number } | null; cohortes: { mes: string; clientes: number; porCliente: number | null }[] };
  adquisicion: { fuente: string; campana: string | null; clientes: number; activos: number; perdidos: number; churn: number | null; permanencia: number; ingresos: number; ltv: number | null; cac: number | null }[];
  reembolsos: string;
}

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const NO = "Sin datos suficientes";
const usd = (n: number, d = 2) => `US$${n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const pct = (n: number | null) => (n == null ? "—" : `${n.toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`);
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const mlabel = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(2, 4)}`;
const PLAN_NAME: Record<string, string> = { basico: "Básico", starter: "Emprende", plus: "Negocio", studio: "Ultra" };
const thisMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date()).slice(0, 7);
const prevM = (m: string) => { const [y, mo] = m.split("-").map(Number); return mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`; };

/** Change vs the month before, as points (for rates) — green when it moves the good way. */
function Trend({ cur, prev, good }: { cur: number | null; prev: number | null; good: "up" | "down" }) {
  if (cur == null || prev == null) return <span className="text-xs text-muted">sin mes anterior para comparar</span>;
  const d = Math.round((cur - prev) * 10) / 10;
  if (d === 0) return <span className="text-xs text-muted">= igual que el mes anterior</span>;
  const ok = good === "up" ? d > 0 : d < 0;
  return <span className={`text-xs font-semibold ${ok ? "text-good" : "text-bad"}`}><span aria-hidden="true">{d > 0 ? "↗" : "↘"}</span> {d > 0 ? "+" : ""}{d.toLocaleString("es-CL")} pts vs mes anterior</span>;
}

function Kpi({ label, value, sub, children, tone }: { label: string; value: string; sub?: string; children?: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
      <span className="text-sm text-muted">{label}</span>
      <span className={`font-display text-xl font-semibold tabular-nums sm:text-2xl ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : ""}`}>{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
      {children}
    </div>
  );
}

/** A small line chart, drawn at its real width; one or two series in the same unit. */
function Lines({ labels, series, unit }: { labels: string[]; series: { name: string; values: (number | null)[]; color: string }[]; unit: "%" | "US$" | "n" }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(520);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 170, P = { l: unit === "US$" ? 62 : 40, r: 12, t: 10, b: 24 };
  const all = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  if (!all.length) return <p className="py-6 text-sm text-muted">{NO}</p>;
  const max = Math.max(unit === "%" ? 10 : 1, ...all) * 1.1;
  const x = (i: number) => P.l + (labels.length > 1 ? (i * (W - P.l - P.r)) / (labels.length - 1) : (W - P.l - P.r) / 2);
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / max);
  const fmt = (v: number) => (unit === "%" ? `${Math.round(v)}%` : unit === "US$" ? usd(v, 0) : `${Math.round(v)}`);
  const path = (vals: (number | null)[]) => vals.map((v, i) => (v == null ? "" : `${vals.slice(0, i).some((p) => p != null) && vals[i - 1] != null ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join("");
  return (
    <div ref={box} className="relative">
      {series.length > 1 && (
        <div className="mb-1 flex flex-wrap gap-4 text-xs text-muted">
          {series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: s.color }} />{s.name}</span>)}
        </div>
      )}
      <svg width={W} height={H} className="block" role="img" aria-label={series.map((s) => s.name).join(" y ")}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const b = e.currentTarget.getBoundingClientRect(); const i = Math.round(((e.clientX - b.left - P.l) / (W - P.l - P.r)) * (labels.length - 1)); setHover(Math.min(labels.length - 1, Math.max(0, i))); }}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-line" />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" fontSize={11} className="fill-current text-muted">{fmt(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => <text key={l} x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} className="fill-current text-muted">{l}</text>)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="currentColor" className="text-muted" strokeDasharray="3 3" />}
        {series.map((s) => <path key={s.name} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />)}
        {series.map((s) => s.values.map((v, i) => v != null && (hover === i || s.values.filter((z) => z != null).length === 1) && <circle key={`${s.name}${i}`} cx={x(i)} cy={y(v)} r={4} fill={s.color} />))}
      </svg>
      {hover != null && (
        <div className="pointer-events-none absolute top-0 right-0 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
          <b>{labels[hover]}</b>
          {series.map((s) => <div key={s.name}>{s.name}: {s.values[hover] == null ? "—" : fmt(s.values[hover]!)}</div>)}
        </div>
      )}
    </div>
  );
}

const C1 = "var(--s1)", C2 = "var(--s2)";

/** For the main view (Estadísticas): churn next to MRR, active and new subscriptions and money collected. */
export function RetencionResumen() {
  const [d, setD] = useState<Data | null>(null);
  useEffect(() => { fetch("/api/admin/retencion?meses=3").then((r) => (r.ok ? r.json() : null)).then(setD).catch(() => {}); }, []);
  if (!d) return null;
  const a = d.actual, b = d.anterior;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi label="MRR (ingreso mensual recurrente)" value={usd(d.hoy.mrr)} sub="Suma de los planes activos hoy" />
      <Kpi label="Suscripciones activas" value={String(d.hoy.activas)} sub={d.hoy.enGracia ? `${d.hoy.enGracia} esperando renovación` : "Hoy"} />
      <Kpi label="Nuevas este mes" value={String(a.nuevas + a.reactivaciones)} sub={a.reactivaciones ? `${a.reactivaciones} volvieron` : `${b.nuevas + b.reactivaciones} el mes anterior`} />
      <Kpi label="Cobrado este mes" value={usd(a.cobrado)} sub={`${usd(b.cobrado)} el mes anterior`} />
      <Kpi label="Churn de clientes (mes)" value={a.base ? pct(a.churn) : NO} sub={a.base ? `${a.perdidos} de ${a.base} clientes` : "Aún no hay clientes de meses anteriores"} tone={a.churn == null ? undefined : a.churn <= 5 ? "good" : a.churn >= 10 ? "bad" : undefined}>
        {a.base > 0 && <Trend cur={a.churn} prev={b.base ? b.churn : null} good="down" />}
      </Kpi>
    </div>
  );
}

export default function Retencion() {
  const [mes, setMes] = useState(thisMonth());
  const [meses, setMeses] = useState(6);
  const [plan, setPlan] = useState("");
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    setErr("");
    const r = await fetch(`/api/admin/retencion?mes=${mes}&meses=${meses}${plan ? `&plan=${plan}` : ""}`).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !j) return setErr(j?.error || "No se pudieron leer las suscripciones.");
    setD(j);
  }, [mes, meses, plan]);
  useEffect(() => { load(); }, [load]);

  const monthOpts: string[] = [];
  for (let m = thisMonth(), i = 0; i < 18; i++, m = prevM(m)) monthOpts.push(m);
  const sel = "rounded-lg border border-line bg-surface px-2 py-1.5 text-sm";
  const a = d?.actual, b = d?.anterior;
  const labels = d?.historia.map((h) => mlabel(h.mes) + (h.parcial ? "*" : "")) ?? [];

  return (
    <div className="ret-viz flex flex-col gap-4">
      <style>{`.ret-viz{--s1:#2a78d6;--s2:#eb6834}
@media (prefers-color-scheme: dark){:root:where(:not([data-theme="light"])) .ret-viz{--s1:#3987e5;--s2:#d95926}}
:root[data-theme="dark"] .ret-viz{--s1:#3987e5;--s2:#d95926}`}</style>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Suscripciones y retención</h2>
          <p className="text-sm text-muted">Cuántos pagan, cuánto tiempo se quedan, cuánta plata recurrente entra y sale, y por qué cancelan.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5">Mes <select value={mes} onChange={(e) => setMes(e.target.value)} className={sel}>{monthOpts.map((m) => <option key={m} value={m}>{mlabel(m)}</option>)}</select></label>
          <label className="flex items-center gap-1.5">Historia <select value={meses} onChange={(e) => setMeses(Number(e.target.value))} className={sel}><option value={3}>3 meses</option><option value={6}>6 meses</option><option value={12}>12 meses</option></select></label>
          <label className="flex items-center gap-1.5">Plan <select value={plan} onChange={(e) => setPlan(e.target.value)} className={sel}><option value="">Todos</option><option value="basico">Básico</option><option value="starter">Emprende</option><option value="plus">Negocio</option><option value="studio">Ultra</option></select></label>
        </div>
      </div>
      <DesdeCero onChange={load} />
      {err && <p className="text-sm text-bad">{err}</p>}
      {!d && !err && <p className="text-sm text-muted">Cargando…</p>}

      {d && a && b && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Churn de clientes" value={a.base ? pct(a.churn) : NO} sub={a.base ? `${a.perdidos} perdidos de ${a.base} activos al inicio` : "Necesita clientes activos al inicio del mes"}>{a.base > 0 && <Trend cur={a.churn} prev={b.base ? b.churn : null} good="down" />}</Kpi>
            <Kpi label="Retención de clientes" value={a.base ? pct(a.retencion) : NO} sub="De los activos al inicio, siguen al cierre">{a.base > 0 && <Trend cur={a.retencion} prev={b.base ? b.retencion : null} good="up" />}</Kpi>
            <Kpi label="Gross revenue churn" value={a.mrrInicio ? pct(a.grossRevenueChurn) : NO} sub="MRR inicial perdido por cancelaciones y bajas de plan">{a.mrrInicio > 0 && <Trend cur={a.grossRevenueChurn} prev={b.mrrInicio ? b.grossRevenueChurn : null} good="down" />}</Kpi>
            <Kpi label="NRR (retención neta de ingresos)" value={a.mrrInicio ? pct(a.nrr) : NO} sub="Incluye subidas y bajadas de plan">{a.mrrInicio > 0 && <Trend cur={a.nrr} prev={b.mrrInicio ? b.nrr : null} good="up" />}</Kpi>
          </div>

          <div className={card}>
            <h3 className="font-semibold">El mes de {mlabel(d.mes)}{a.parcial ? " (en curso)" : ""}</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              {[
                ["Suscripciones activas hoy", String(d.hoy.activas)], ["Nuevas suscripciones", String(a.nuevas)], ["Volvieron (reactivaciones)", String(a.reactivaciones)], ["Renovaciones cobradas", String(a.renovaciones)],
                ["Cancelaciones solicitadas", String(a.solicitadas)], ["Cancelaciones efectivas", String(a.canceladasEfectivas)], ["MRR perdido por cancelaciones", usd(a.mrrPerdido)], ["MRR perdido por bajas de plan", usd(a.mrrContraccion)],
                ["MRR ganado por subidas de plan", usd(a.mrrExpansion)], ["MRR de clientes nuevos", usd(a.mrrNuevo)], ["MRR al cierre", usd(a.mrrFin)], ["Permanencia promedio", d.permanencia == null ? NO : `${d.permanencia.toLocaleString("es-CL")} meses`],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col"><dt className="text-xs text-muted">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
              ))}
            </dl>
            <p className="text-xs text-muted">Una cancelación solicitada no es churn: el cliente se cuenta como perdido recién cuando termina su acceso pagado sin renovar (con 7 días de gracia si no canceló, por si Mercado Pago reintenta el cobro).</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={card}>
              <h3 className="font-semibold">Churn de clientes y de ingresos por mes</h3>
              <Lines labels={labels} unit="%" series={[{ name: "Churn de clientes", values: d.historia.map((h) => (h.base ? h.churn : null)), color: C2 }, { name: "Gross revenue churn", values: d.historia.map((h) => (h.mrrInicio ? h.grossRevenueChurn : null)), color: C1 }]} />
            </div>
            <div className={card}>
              <h3 className="font-semibold">MRR al cierre de cada mes</h3>
              <Lines labels={labels} unit="US$" series={[{ name: "MRR", values: d.historia.map((h) => h.mrrFin), color: C1 }]} />
            </div>
            <div className={card}>
              <h3 className="font-semibold">Suscripciones activas al cierre</h3>
              <Lines labels={labels} unit="n" series={[{ name: "Activas", values: d.historia.map((h) => h.activosFin), color: C1 }]} />
            </div>
            <div className={card}>
              <h3 className="font-semibold">NRR por mes</h3>
              <Lines labels={labels} unit="%" series={[{ name: "NRR", values: d.historia.map((h) => (h.mrrInicio ? h.nrr : null)), color: C1 }]} />
            </div>
          </div>
          <p className="-mt-2 text-xs text-muted">* mes en curso (todavía puede cambiar).</p>

          <div className={card}>
            <h3 className="font-semibold">Planes comparados ({mlabel(d.mes)})</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead className="text-left text-xs text-muted"><tr><th className="py-2 font-semibold">Plan</th><th className="font-semibold">Activos</th><th className="font-semibold">Nuevos</th><th className="font-semibold">Perdidos</th><th className="font-semibold">Churn</th><th className="font-semibold">MRR</th><th className="font-semibold">MRR perdido</th><th className="font-semibold">Permanencia</th></tr></thead>
                <tbody className="tabular-nums">
                  {d.porPlan.map((p) => (
                    <tr key={p.id} className="border-t border-line">
                      <td className="py-2 font-semibold">{p.nombre}</td><td>{p.activos}</td><td>{p.nuevos}</td><td>{p.perdidos}</td>
                      <td className={p.churn == null ? "text-muted" : p.churn >= 10 ? "text-bad" : ""}>{p.base ? pct(p.churn) : "—"}</td>
                      <td>{usd(p.mrr)}</td><td>{usd(p.mrrPerdido)}</td><td>{p.permanencia == null ? "—" : `${p.permanencia} m`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={card}>
              <h3 className="font-semibold">Por qué cancelan</h3>
              {d.motivos.length === 0 ? <p className="text-sm text-muted">Nadie ha cancelado en este período.</p> : (
                <ul className="flex flex-col gap-2">
                  {d.motivos.map((m) => {
                    const max = d.motivos[0].n;
                    return (
                      <li key={m.motivo} className="flex flex-col gap-1 text-sm">
                        <span className="flex justify-between gap-3"><span>{m.motivo}</span><b className="tabular-nums">{m.n}</b></span>
                        <span className="h-2 rounded-full bg-surface-2"><span className="block h-2 rounded-full" style={{ width: `${(m.n / max) * 100}%`, background: "var(--s1)" }} /></span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <div className={card}>
              <h3 className="font-semibold">Lo que escribieron al cancelar</h3>
              {d.comentarios.length === 0 ? <p className="text-sm text-muted">Sin comentarios todavía.</p> : (
                <ul className="flex flex-col divide-y divide-line text-sm">
                  {d.comentarios.map((c, i) => (
                    <li key={i} className="py-2">
                      <span className="text-xs text-muted">{new Date(c.at).toLocaleDateString("es-CL")} · {c.motivo}{c.plan ? ` · ${PLAN_NAME[c.plan] ?? c.plan}` : ""}</span>
                      <p>{c.texto}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className={card}>
            <h3 className="font-semibold">Retención por cohorte</h3>
            <p className="text-xs text-muted">Clientes agrupados por el mes de su primer pago: qué % sigue activo al cierre de cada mes siguiente.</p>
            {d.cohortes.every((c) => !c.size) ? <p className="text-sm text-muted">{NO}</p> : (
              <div className="overflow-x-auto">
                <table className="text-sm">
                  <thead className="text-left text-xs text-muted"><tr><th className="py-2 pr-4 font-semibold">Cohorte</th><th className="pr-4 font-semibold">Clientes</th>{d.cohortes[0].cells.map((_, i) => <th key={i} className="px-2 font-semibold">Mes {i}</th>)}</tr></thead>
                  <tbody className="tabular-nums">
                    {d.cohortes.filter((c) => c.size).map((c) => (
                      <tr key={c.month} className="border-t border-line">
                        <td className="py-2 pr-4">{mlabel(c.month)}</td><td className="pr-4">{c.size}</td>
                        {c.cells.map((v, i) => <td key={i} className="px-2 text-center" style={v == null ? undefined : { background: `color-mix(in oklab, var(--s1) ${Math.round(v * 0.55)}%, transparent)` }}>{v == null ? "" : `${Math.round(v)}%`}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={card}>
              <h3 className="font-semibold">Valor de vida del cliente (LTV)</h3>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-xs text-muted">LTV observado (plata real cobrada por cliente)</dt><dd className="font-display text-xl font-semibold">{d.ltv.observado == null ? NO : usd(d.ltv.observado)}</dd><dd className="text-xs text-muted">{d.ltv.clientes} clientes · {usd(d.ltv.total)} en total</dd></div>
                <div><dt className="text-xs text-muted">LTV estimado (con margen y churn)</dt><dd className="font-display text-xl font-semibold">{d.ltv.estimado ? usd(d.ltv.estimado.valor) : NO}</dd>
                  <dd className="text-xs text-muted">{d.ltv.estimado ? `Ingreso por cliente ${usd(d.ltv.estimado.arpu)}/mes × margen ${d.ltv.estimado.margen}% ÷ churn ${d.ltv.estimado.churnMedio}%` : "Se calcula con 3 meses cerrados de al menos 10 clientes."}</dd></div>
              </dl>
              <table className="text-sm">
                <thead className="text-left text-xs text-muted"><tr><th className="py-1 pr-4 font-semibold">Cohorte</th><th className="pr-4 font-semibold">Clientes</th><th className="font-semibold">Cobrado por cliente</th></tr></thead>
                <tbody className="tabular-nums">{d.ltv.cohortes.filter((c) => c.clientes).map((c) => <tr key={c.mes} className="border-t border-line"><td className="py-1 pr-4">{mlabel(c.mes)}</td><td className="pr-4">{c.clientes}</td><td>{c.porCliente == null ? "—" : usd(c.porCliente)}</td></tr>)}</tbody>
              </table>
              <p className="text-xs text-muted">Montos en US$ al dólar de hoy (los pagos se cobran en pesos). El margen estimado supone que el cliente usa todo su saldo. {d.reembolsos}</p>
            </div>
            <div className={card}>
              <h3 className="font-semibold">LTV / CAC</h3>
              <p className="font-display text-xl font-semibold">{NO}</p>
              <p className="text-sm text-muted">Se activa cuando Meta esté conectado (gasto por campaña) y los anuncios lleven <b>utm_campaign</b>. No mostramos un número inventado mientras tanto.</p>
            </div>
          </div>

          <div className={card}>
            <h3 className="font-semibold">Retención por origen y campaña</h3>
            <p className="text-xs text-muted">De dónde llegó cada cliente (solo si aceptó cookies; si no, aparece como «Sin dato de origen», nunca se adivina). La campaña sale del <b>utm_campaign</b> del anuncio: en Meta, pon en «Parámetros de URL» <code>utm_source=facebook&amp;utm_campaign={"{{campaign.name}}"}</code>.</p>
            {d.adquisicion.length === 0 ? <p className="text-sm text-muted">{NO}</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="text-left text-xs text-muted"><tr><th className="py-2 font-semibold">Origen</th><th className="font-semibold">Campaña</th><th className="font-semibold">Clientes</th><th className="font-semibold">Activos</th><th className="font-semibold">Perdidos</th><th className="font-semibold">Churn</th><th className="font-semibold">Permanencia</th><th className="font-semibold">Cobrado</th><th className="font-semibold">LTV</th><th className="font-semibold">CAC</th></tr></thead>
                  <tbody className="tabular-nums">
                    {d.adquisicion.map((g, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className="py-2">{g.fuente}</td><td className="max-w-48 truncate" title={g.campana ?? ""}>{g.campana ?? "—"}</td><td>{g.clientes}</td><td>{g.activos}</td><td>{g.perdidos}</td><td>{pct(g.churn)}</td>
                        <td>{g.permanencia} m</td><td>{usd(g.ingresos)}</td><td>{g.ltv == null ? "—" : usd(g.ltv)}</td><td className="text-muted">—</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-xs text-muted">Se calcula con el historial real de pagos de Mercado Pago (cada cobro aprobado), sin contar tu cuenta ni cuentas de prueba. Actualizado {new Date(d.updated).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</p>
        </>
      )}
    </div>
  );
}
