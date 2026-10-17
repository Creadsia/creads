"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Period } from "@/lib/stats";

// Panel → Estadísticas: sales, customers and visits for a date range, compared with the period right
// before (dashed). Built like Shopify's analytics so the owner reads it the same way.

type Row = { k: string; n: number; prev: number };
interface Data {
  range: { from: string; to: string }; prev: { from: string; to: string }; statsReady: boolean; updated: string;
  cur: Period; before: Period;
  productos: Row[]; ventasFuente: Row[]; dispositivo: Row[]; ubicacion: Row[]; fuente: Row[]; paginas: Row[];
  cohortes: { month: string; size: number; cells: number[] }[];
}
interface Cfg { ivaPct?: number; pctChile?: number }

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const usd = (n: number, d = 0) => `${n < 0 ? "−" : ""}US$${Math.abs(n).toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const usdShort = (n: number) => (Math.abs(n) >= 1000 ? `US$${(n / 1000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} k` : usd(n));
const int = (n: number) => Math.round(n).toLocaleString("es-CL");
const pct = (n: number, d = 1) => `${(n * 100).toLocaleString("es-CL", { maximumFractionDigits: d })}%`;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const dlabel = (d: string) => `${Number(d.slice(8, 10))} ${MESES[Number(d.slice(5, 7)) - 1]}`;
const dlong = (r: { from: string; to: string }) => (r.from === r.to ? `${dlabel(r.from)} de ${r.from.slice(0, 4)}` : `${dlabel(r.from)} – ${dlabel(r.to)} de ${r.to.slice(0, 4)}`);
const mlabel = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`;

// ---------------------------------------------------------------- date range

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
const shift = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const PRESETS: { id: string; name: string; range: () => { from: string; to: string } }[] = [
  { id: "hoy", name: "Hoy", range: () => ({ from: today(), to: today() }) },
  { id: "ayer", name: "Ayer", range: () => ({ from: shift(today(), -1), to: shift(today(), -1) }) },
  { id: "7", name: "Últimos 7 días", range: () => ({ from: shift(today(), -6), to: today() }) },
  { id: "30", name: "Últimos 30 días", range: () => ({ from: shift(today(), -29), to: today() }) },
  { id: "mes", name: "Este mes", range: () => ({ from: `${today().slice(0, 8)}01`, to: today() }) },
  { id: "mes-1", name: "Mes pasado", range: () => { const first = `${today().slice(0, 8)}01`; const end = shift(first, -1); return { from: `${end.slice(0, 8)}01`, to: end }; } },
  { id: "90", name: "Últimos 90 días", range: () => ({ from: shift(today(), -89), to: today() }) },
  { id: "ano", name: "Este año", range: () => ({ from: `${today().slice(0, 4)}-01-01`, to: today() }) },
  { id: "custom", name: "Personalizado", range: () => ({ from: shift(today(), -29), to: today() }) },
];

// ---------------------------------------------------------------- small pieces

function Delta({ cur, prev, down = false }: { cur: number; prev: number; down?: boolean }) {
  if (!prev && !cur) return <span className="text-xs text-muted">—</span>;
  if (!prev) return <span className="text-xs font-semibold text-good">nuevo</span>;
  const ch = (cur - prev) / Math.abs(prev);
  const good = down ? ch <= 0 : ch >= 0;
  return (
    <span className={`whitespace-nowrap text-xs font-semibold ${good ? "text-good" : "text-bad"}`} title={`Período anterior: ${prev.toLocaleString("es-CL")}`}>
      <span aria-hidden="true">{ch >= 0 ? "↗" : "↘"}</span> {Math.abs(Math.round(ch * 100))}%<span className="sr-only">{ch >= 0 ? " más" : " menos"} que el período anterior</span>
    </span>
  );
}

function path(vals: number[], w: number, h: number, max: number, pad = 2) {
  if (!vals.length) return "";
  const step = vals.length > 1 ? (w - pad * 2) / (vals.length - 1) : 0;
  return vals.map((v, i) => `${i ? "L" : "M"}${(pad + i * step).toFixed(1)},${(h - pad - (max ? (v / max) * (h - pad * 2) : 0)).toFixed(1)}`).join(" ");
}

function Spark({ a, b }: { a: number[]; b: number[] }) {
  const max = Math.max(1, ...a, ...b);
  return (
    <svg viewBox="0 0 120 36" className="h-9 w-28" aria-hidden="true" preserveAspectRatio="none">
      <path d={path(b, 120, 36, max)} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" opacity="0.7" />
      <path d={path(a, 120, 36, max)} fill="none" stroke="var(--viz-1)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

function Kpi({ label, value, cur, prev, a, b, down, hint }: { label: string; value: string; cur: number; prev: number; a: number[]; b: number[]; down?: boolean; hint?: string }) {
  return (
    <div className={`${card} gap-1.5`} title={hint}>
      <span className="text-sm font-semibold text-muted">{label}</span>
      <div className="flex items-end justify-between gap-2">
        <span className="flex items-baseline gap-2"><b className="font-mono text-2xl tabular-nums">{value}</b><Delta cur={cur} prev={prev} down={down} /></span>
        <Spark a={a} b={b} />
      </div>
    </div>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const niceMax = (v: number) => { if (v <= 0) return 1; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };

/** Current period (solid) against the period before (dashed), with a crosshair and tooltip on hover. */
function LineChart({ days, a, b, prevDays, fmt, axis, h = 240 }: { days: string[]; a: number[]; b: number[]; prevDays: string[]; fmt: (n: number) => string; axis: (n: number) => string; h?: number }) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const L = 52, R = 12, T = 10, B = 26;
  const max = niceMax(Math.max(...a, ...b, 0));
  const iw = w - L - R, ih = h - T - B;
  const x = (i: number) => L + (days.length > 1 ? (i / (days.length - 1)) * iw : iw / 2);
  const y = (v: number) => T + ih - (v / max) * ih;
  const line = (v: number[]) => v.map((n, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(" ");
  const every = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(iw / 70))));
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((k) => k * max);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - L) / iw) * (days.length - 1));
    setHover(Math.min(days.length - 1, Math.max(0, i)));
  };
  return (
    <div ref={ref} className="relative">
      <svg width={w} height={h} role="img" aria-label="Gráfico del período comparado con el anterior" onPointerMove={onMove} onPointerLeave={() => setHover(null)} className="block touch-none">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-[var(--muted)] font-mono text-[11px]">{axis(t)}</text>
          </g>
        ))}
        {days.map((d, i) => (i % every === 0 ? <text key={d} x={x(i)} y={h - 6} textAnchor="middle" className="fill-[var(--muted)] text-[11px]">{dlabel(d)}</text> : null))}
        <path d={line(b)} fill="none" stroke="var(--muted)" strokeWidth="2" strokeDasharray="5 5" opacity="0.75" />
        <path d={line(a)} fill="none" stroke="var(--viz-1)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={T + ih} stroke="var(--muted)" strokeWidth="1" />
            <circle cx={x(hover)} cy={y(b[hover] ?? 0)} r="4" fill="var(--surface)" stroke="var(--muted)" strokeWidth="2" />
            <circle cx={x(hover)} cy={y(a[hover] ?? 0)} r="4.5" fill="var(--viz-1)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-1 z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg" style={{ left: Math.min(w - 190, Math.max(0, x(hover) + 12)) }}>
          <div className="flex items-center gap-2"><i className="h-0.5 w-4 bg-[var(--viz-1)]" /> {dlabel(days[hover])}: <b className="font-mono">{fmt(a[hover] ?? 0)}</b></div>
          {prevDays[hover] && <div className="mt-1 flex items-center gap-2 text-muted"><i className="h-0.5 w-4 border-t-2 border-dashed border-[var(--muted)]" /> {dlabel(prevDays[hover])}: <b className="font-mono">{fmt(b[hover] ?? 0)}</b></div>}
        </div>
      )}
    </div>
  );
}

function Legend({ r, p }: { r: { from: string; to: string }; p: { from: string; to: string } }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-muted">
      <span className="flex items-center gap-1.5"><i className="h-0.5 w-5 bg-[var(--viz-1)]" />{dlong(r)}</span>
      <span className="flex items-center gap-1.5"><i className="h-0 w-5 border-t-2 border-dashed border-[var(--muted)]" />{dlong(p)}</span>
    </div>
  );
}

/** Current (solid) and previous (light) bars per item, with values and change. */
function HBars({ rows, fmt, empty }: { rows: Row[]; fmt: (n: number) => string; empty: string }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  const max = Math.max(1, ...rows.flatMap((r) => [r.n, r.prev]));
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.k} className="flex flex-col gap-1" title={`${r.k}: ${fmt(r.n)} (antes ${fmt(r.prev)})`}>
          <span className="truncate text-xs text-muted">{r.k}</span>
          <span className="flex items-center gap-2">
            <i className="h-3 rounded-r-[4px] bg-[var(--viz-1)]" style={{ width: `${Math.max(1.5, (r.n / max) * 70)}%` }} />
            <b className="font-mono text-xs tabular-nums">{fmt(r.n)}</b>
            <Delta cur={r.n} prev={r.prev} />
          </span>
          <span className="flex items-center gap-2">
            <i className="h-2 rounded-r-[4px] bg-[var(--muted)] opacity-40" style={{ width: `${Math.max(1.5, (r.prev / max) * 70)}%` }} />
            <span className="font-mono text-[11px] text-muted tabular-nums">{fmt(r.prev)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function Donut({ rows, center, sub }: { rows: Row[]; center: string; sub: React.ReactNode }) {
  const total = rows.reduce((a, r) => a + r.n, 0);
  const colors = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)"];
  const R = 70, C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative h-44 w-44 shrink-0">
        <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="90" cy="90" r={R} fill="none" stroke="var(--surface-2)" strokeWidth="22" />
          {total > 0 && rows.slice(0, 3).map((r, i) => {
            const len = (r.n / total) * C;
            const el = <circle key={r.k} cx="90" cy="90" r={R} fill="none" stroke={colors[i]} strokeWidth="22" strokeDasharray={`${Math.max(0, len - 3)} ${C}`} strokeDashoffset={-acc} />;
            acc += len;
            return el;
          })}
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center"><b className="font-mono text-2xl">{center}</b>{sub}</span>
      </div>
      <ul className="flex min-w-[10rem] flex-1 flex-col gap-2 text-sm">
        {rows.slice(0, 3).map((r, i) => (
          <li key={r.k} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-sm" style={{ background: colors[i] }} />{r.k}</span>
            <span className="flex items-center gap-2"><b className="font-mono">{int(r.n)}</b><Delta cur={r.n} prev={r.prev} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Funnel({ steps }: { steps: { label: string; n: number; prev: number }[] }) {
  const top = Math.max(1, ...steps.map((s) => s.n));
  return (
    <div className="grid grid-cols-4 gap-1">
      {steps.map((s, i) => (
        <div key={s.label} className="flex min-w-0 flex-col gap-2">
          <div className="flex min-h-[4.5rem] flex-col gap-0.5 border-l border-line pl-2">
            <span className="text-xs leading-tight text-muted hyphens-auto">{s.label}</span>
            <b className="font-mono text-lg">{i === 0 ? (s.n ? "100%" : "—") : steps[0].n ? pct(s.n / steps[0].n, 2) : "—"}</b>
            <span className="flex flex-wrap items-center gap-1 font-mono text-xs text-muted">{int(s.n)} <Delta cur={s.n} prev={s.prev} /></span>
          </div>
          <div className="flex h-36 items-end">
            <i className="w-full rounded-t-[4px] bg-[var(--viz-1)]" style={{ height: `${Math.min(100, Math.max(2, (s.n / top) * 100))}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- the page

export default function Estadisticas({ cfg }: { cfg?: Cfg }) {
  const [preset, setPreset] = useState("mes");
  const [range, setRange] = useState(() => PRESETS.find((p) => p.id === "mes")!.range());
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBusy(true); setErr("");
    fetch(`/api/admin/estadisticas?from=${range.from}&to=${range.to}`)
      .then((r) => r.json().then((x) => ({ ok: r.ok, x })))
      .then(({ ok, x }) => { if (!ok) throw new Error(x.error); setD(x); })
      .catch((e) => setErr(e instanceof Error && e.message ? e.message : "No se pudieron cargar las estadísticas."))
      .finally(() => setBusy(false));
  }, [range.from, range.to]);
  useEffect(() => { load(); }, [load]);

  const choose = (id: string) => { setPreset(id); if (id !== "custom") setRange(PRESETS.find((p) => p.id === id)!.range()); };

  const view = useMemo(() => {
    if (!d) return null;
    const c = d.cur, p = d.before;
    const ivaPct = Math.max(0, Number(cfg?.ivaPct ?? 19)), chile = Math.min(100, Math.max(0, Number(cfg?.pctChile ?? 100))) / 100;
    const iva = (n: number) => n * chile * (ivaPct / (100 + ivaPct));
    const series = (k: keyof Period["daily"][number]) => [c.daily.map((x) => Number(x[k])), p.daily.map((x) => Number(x[k]))] as const;
    return { c, p, iva, series, days: c.daily.map((x) => x.day), prevDays: p.daily.map((x) => x.day) };
  }, [d, cfg]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="est-rango">Período</label>
          <select id="est-rango" value={preset} onChange={(e) => choose(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold">
            {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {preset === "custom" && (
            <span className="flex items-center gap-1.5 text-sm">
              <input type="date" aria-label="Desde" value={range.from} max={range.to < today() ? range.to : today()} onChange={(e) => e.target.value && setRange((r) => ({ ...r, from: e.target.value }))} className="rounded-lg border border-line bg-surface px-2 py-1.5" />
              –
              <input type="date" aria-label="Hasta" value={range.to} min={range.from} max={today()} onChange={(e) => e.target.value && setRange((r) => ({ ...r, to: e.target.value }))} className="rounded-lg border border-line bg-surface px-2 py-1.5" />
            </span>
          )}
          {d && <span className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">Comparado con {dlong(d.prev)}</span>}
          <span className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">US$</span>
        </div>
        <span className="flex items-center gap-3 text-sm text-muted">
          {d && `Actualizado ${new Date(d.updated).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}`}
          <button type="button" onClick={load} disabled={busy} className="rounded-lg border border-line px-3 py-1.5 font-semibold hover:text-ink">{busy ? "Cargando…" : "Actualizar"}</button>
        </span>
      </div>

      {err && <p role="alert" className="rounded-xl border border-bad/40 bg-bad/10 px-4 py-3 text-sm text-bad">{err}</p>}
      {d && !d.statsReady && (
        <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">Las visitas todavía no se cuentan: ejecuta <b>supabase/stats.sql</b> en Supabase → SQL Editor (5 minutos, está en la lista de Lanzamiento). Las ventas y clientes ya funcionan.</p>
      )}
      {!view ? (!err && <p className="text-muted">Cargando estadísticas…</p>) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Ventas totales" value={usd(view.c.neto)} cur={view.c.neto} prev={view.p.neto} a={view.series("ventas")[0]} b={view.series("ventas")[1]} />
            <Kpi label="Pedidos pagados" value={int(view.c.pedidos)} cur={view.c.pedidos} prev={view.p.pedidos} a={view.series("pedidos")[0]} b={view.series("pedidos")[1]} />
            <Kpi label="Cuentas nuevas" value={int(view.c.nuevos)} cur={view.c.nuevos} prev={view.p.nuevos} a={view.series("nuevos")[0]} b={view.series("nuevos")[1]} />
            <Kpi label="Clientes que repiten" value={pct(view.c.habituales, 1)} cur={view.c.habituales} prev={view.p.habituales} a={[]} b={[]} hint="De los clientes que pagaron en el período, cuántos ya habían pagado antes o pagaron más de una vez." />
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <section className={`${card} xl:col-span-2`} aria-labelledby="h-ventas">
              <div className="flex flex-col">
                <h3 id="h-ventas" className="text-sm font-semibold text-muted">Ventas totales a lo largo del tiempo</h3>
                <span className="flex items-baseline gap-2"><b className="font-mono text-2xl">{usd(view.c.neto)}</b><Delta cur={view.c.neto} prev={view.p.neto} /></span>
              </div>
              <LineChart days={view.days} prevDays={view.prevDays} a={view.series("ventas")[0]} b={view.series("ventas")[1]} fmt={(n) => usd(n, 2)} axis={usdShort} h={260} />
              <Legend r={d!.range} p={d!.prev} />
            </section>
            <section className={card} aria-labelledby="h-desglose">
              <h3 id="h-desglose" className="text-sm font-semibold text-muted">Desglose de ventas</h3>
              <dl className="flex flex-col divide-y divide-line text-sm">
                {([
                  ["Ventas brutas", view.c.bruto, view.p.bruto, false],
                  ["Descuentos", -view.c.descuentos, -view.p.descuentos, true],
                  ["Ventas netas", view.c.neto - view.iva(view.c.neto), view.p.neto - view.iva(view.p.neto), false],
                  [`IVA (${cfg?.ivaPct ?? 19}%, va al SII)`, view.iva(view.c.neto), view.iva(view.p.neto), false],
                  ["Ventas totales", view.c.neto, view.p.neto, false],
                ] as [string, number, number, boolean][]).map(([k, v, pv, neg], i, all) => (
                  <div key={k} className={`flex items-center justify-between gap-2 py-2.5 ${i === all.length - 1 ? "font-semibold" : ""}`}>
                    <dt className={i === all.length - 1 ? "" : "text-accent-text"}>{k}</dt>
                    <dd className="flex items-center gap-2"><b className="font-mono tabular-nums">{usd(v, 2)}</b><Delta cur={Math.abs(v)} prev={Math.abs(pv)} down={neg} /></dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted">Precios con IVA incluido. El IVA usa el % y la parte de ventas en Chile de Costos fijos.</p>
            </section>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <section className={card} aria-labelledby="h-prod">
              <h3 id="h-prod" className="text-sm font-semibold text-muted">Ventas por producto</h3>
              <HBars rows={d!.productos} fmt={(n) => usd(n)} empty="Sin ventas en este período." />
            </section>
            <section className={card} aria-labelledby="h-aov">
              <div className="flex flex-col">
                <h3 id="h-aov" className="text-sm font-semibold text-muted">Valor medio del pedido</h3>
                <span className="flex items-baseline gap-2"><b className="font-mono text-2xl">{usd(view.c.aov, 2)}</b><Delta cur={view.c.aov} prev={view.p.aov} /></span>
              </div>
              <LineChart days={view.days} prevDays={view.prevDays} a={view.series("aov")[0]} b={view.series("aov")[1]} fmt={(n) => usd(n, 2)} axis={usdShort} h={190} />
            </section>
            <section className={card} aria-labelledby="h-funnel">
              <div className="flex flex-col">
                <h3 id="h-funnel" className="text-sm font-semibold text-muted">Embudo de conversión</h3>
                <span className="flex items-baseline gap-2"><b className="font-mono text-2xl">{pct(view.c.conversion, 2)}</b><Delta cur={view.c.conversion} prev={view.p.conversion} /></span>
              </div>
              <Funnel steps={[
                { label: "Visitas", n: view.c.sesiones, prev: view.p.sesiones },
                { label: "Cuentas creadas", n: view.c.nuevos, prev: view.p.nuevos },
                { label: "Llegaron al pago", n: view.c.checkout, prev: view.p.checkout },
                { label: "Pagaron", n: view.c.pedidos, prev: view.p.pedidos },
              ]} />
            </section>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <section className={card} aria-labelledby="h-ses">
              <div className="flex flex-col">
                <h3 id="h-ses" className="text-sm font-semibold text-muted">Visitas a lo largo del tiempo</h3>
                <span className="flex items-baseline gap-2"><b className="font-mono text-2xl">{int(view.c.sesiones)}</b><Delta cur={view.c.sesiones} prev={view.p.sesiones} /></span>
              </div>
              <LineChart days={view.days} prevDays={view.prevDays} a={view.series("sesiones")[0]} b={view.series("sesiones")[1]} fmt={int} axis={(n) => int(n)} h={190} />
            </section>
            <section className={card} aria-labelledby="h-dev">
              <h3 id="h-dev" className="text-sm font-semibold text-muted">Visitas por dispositivo</h3>
              <Donut rows={d!.dispositivo} center={int(view.c.sesiones)} sub={<Delta cur={view.c.sesiones} prev={view.p.sesiones} />} />
            </section>
            <section className={card} aria-labelledby="h-loc">
              <h3 id="h-loc" className="text-sm font-semibold text-muted">Visitas por ubicación</h3>
              <HBars rows={d!.ubicacion} fmt={int} empty="Todavía no hay visitas contadas." />
            </section>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <section className={card} aria-labelledby="h-src">
              <h3 id="h-src" className="text-sm font-semibold text-muted">Visitas por canal</h3>
              <HBars rows={d!.fuente} fmt={int} empty="Todavía no hay visitas contadas." />
            </section>
            <section className={card} aria-labelledby="h-vsrc">
              <h3 id="h-vsrc" className="text-sm font-semibold text-muted">Ventas por canal</h3>
              <HBars rows={d!.ventasFuente} fmt={(n) => usd(n)} empty="Sin ventas en este período." />
              <p className="text-xs text-muted">El canal por el que el cliente llegó la primera vez (Instagram, Facebook, Google, directo…).</p>
            </section>
            <section className={card} aria-labelledby="h-land">
              <h3 id="h-land" className="text-sm font-semibold text-muted">Visitas por página de entrada</h3>
              {d!.paginas.length ? (
                <table className="w-full table-fixed text-sm">
                  <tbody className="divide-y divide-line">
                    {d!.paginas.map((r) => (
                      <tr key={r.k}><td className="truncate py-2 pr-2 font-mono text-xs" title={r.k}>{r.k}</td><td className="w-16 py-2 text-right font-mono">{int(r.n)}</td><td className="w-16 py-2 text-right"><Delta cur={r.n} prev={r.prev} /></td></tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="py-6 text-center text-sm text-muted">Todavía no hay visitas contadas.</p>}
            </section>
          </div>

          <section className={card} aria-labelledby="h-coh">
            <div className="flex flex-col gap-0.5">
              <h3 id="h-coh" className="text-sm font-semibold text-muted">Clientes que vuelven a pagar (por mes en que crearon su cuenta)</h3>
              <p className="text-xs text-muted">De las cuentas creadas cada mes, qué porcentaje pagó ese mes (mes 0) y en los meses siguientes. Es la mejor señal de que Creads les sirve.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-separate border-spacing-1 text-center text-xs">
                <thead><tr><th className="text-left font-semibold text-muted">Mes</th><th className="font-semibold text-muted">Cuentas</th>{d!.cohortes.map((_, k) => <th key={k} className="font-semibold text-muted">Mes {k}</th>)}</tr></thead>
                <tbody>
                  {d!.cohortes.map((r) => (
                    <tr key={r.month}>
                      <td className="whitespace-nowrap py-1.5 text-left">{mlabel(r.month)}</td>
                      <td className="font-mono">{int(r.size)}</td>
                      {d!.cohortes.map((_, k) => {
                        const v = r.cells[k];
                        return v === undefined ? <td key={k} /> : (
                          <td key={k} className="rounded-md py-1.5 font-mono" style={{ background: `color-mix(in oklab, var(--viz-1) ${Math.round(6 + Math.min(1, v) * 64)}%, var(--surface))` }}>{pct(v, 0)}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
