"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DesdeCero from "./desde-cero";
import Rentable from "./rentable";

// Panel → Marketing → Resultados de campañas (owner, 22 Oct 2026: «los datos de Facebook y los de Creads por
// las compras en un dashboard»). Meta's spend and clicks next to what really happened in Creads (accounts,
// checkouts, sales, money), so the owner sees what each dollar of ads brings back. All in US$.

interface MetaRow { spend: number; impressions: number; clicks: number; regs: number; checkouts: number; buys: number; buyValue: number }
interface Day { day: string; cuentas: number; pagosIniciados: number; ventas: number; ventasMeta: number; ingresos: number; ingresosMeta: number; meta: (MetaRow & { day: string }) | null }
interface Camp extends MetaRow { id: string; nombre: string; estado: string; presupuestoUsd: number | null }
interface Data {
  range: { from: string; to: string }; updated: string; regalos?: number;
  meta: { connected: boolean; error?: string; campaigns: Camp[] };
  total: { gasto: number; impresiones: number; clics: number; metaRegistros: number; metaPagos: number; metaCompras: number; metaValor: number; cuentas: number; pagosIniciados: number; ventas: number; ventasMeta: number; ingresos: number; ingresosMeta: number };
  porDia: Day[];
}

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const usd = (n: number, d = 0) => `US$${n.toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const int = (n: number) => Math.round(n).toLocaleString("es-CL");
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`);
const money = (n: number | null, d = 2) => (n == null ? "—" : usd(n, d));
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];
const dlabel = (d: string) => `${Number(d.slice(8, 10))} ${MESES[Number(d.slice(5, 7)) - 1]}`;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
const shift = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const PRESETS = [
  { id: "hoy", name: "Hoy", r: () => ({ from: today(), to: today() }) },
  { id: "ayer", name: "Ayer", r: () => ({ from: shift(today(), -1), to: shift(today(), -1) }) },
  { id: "7", name: "7 días", r: () => ({ from: shift(today(), -6), to: today() }) },
  { id: "30", name: "30 días", r: () => ({ from: shift(today(), -29), to: today() }) },
  { id: "mes", name: "Este mes", r: () => ({ from: `${today().slice(0, 8)}01`, to: today() }) },
];
const ESTADO: Record<string, string> = { ACTIVE: "Activa", PAUSED: "Pausada", CAMPAIGN_PAUSED: "Pausada", ARCHIVED: "Archivada", IN_PROCESS: "Revisándose", WITH_ISSUES: "Con problemas", DELETED: "Borrada" };

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-line bg-surface p-4">
      <span className="text-sm text-muted">{label}</span>
      <span className={`font-display text-xl font-semibold tabular-nums sm:text-2xl ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : ""}`}>{value}</span>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

/** Ventas vs gasto per day: two lines on the same US$ axis, with a hover readout. */
function Chart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  // drawn at the real width, so the text stays the size of the page's text
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = 220, P = { l: 64, r: 16, t: 12, b: 26 };
  const sales = days.map((d) => d.ingresos), spend = days.map((d) => d.meta?.spend ?? 0);
  const max = Math.max(1, ...sales, ...spend);
  const nice = Math.pow(10, Math.floor(Math.log10(max))) * (max / Math.pow(10, Math.floor(Math.log10(max))) > 5 ? 10 : max / Math.pow(10, Math.floor(Math.log10(max))) > 2 ? 5 : 2);
  const x = (i: number) => P.l + (days.length > 1 ? (i * (W - P.l - P.r)) / (days.length - 1) : (W - P.l - P.r) / 2);
  const y = (v: number) => P.t + (H - P.t - P.b) * (1 - v / nice);
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ticks = [0, nice / 2, nice];
  const every = Math.max(1, Math.ceil(days.length / Math.max(2, Math.floor(W / 90))));
  const h = hover != null ? days[hover] : null;
  return (
    <div ref={box} className="camp-viz relative">
      <style>{`.camp-viz{--s1:#2a78d6;--s2:#eb6834}
@media (prefers-color-scheme: dark){:root:where(:not([data-theme="light"])) .camp-viz{--s1:#3987e5;--s2:#d95926}}
:root[data-theme="dark"] .camp-viz{--s1:#3987e5;--s2:#d95926}`}</style>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: "var(--s1)" }} />Ventas en Creads</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded" style={{ background: "var(--s2)" }} />Gasto en Meta</span>
      </div>
      <svg width={W} height={H} className="block" role="img" aria-label="Ventas en Creads y gasto en Meta por día, en dólares"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const b = e.currentTarget.getBoundingClientRect(); const px = e.clientX - b.left; const i = Math.round(((px - P.l) / (W - P.l - P.r)) * (days.length - 1)); setHover(Math.min(days.length - 1, Math.max(0, i))); }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="currentColor" className="text-line" strokeWidth={1} />
            <text x={P.l - 6} y={y(t) + 4} textAnchor="end" className="fill-current text-muted" fontSize={11}>{usd(t)}</text>
          </g>
        ))}
        {days.map((d, i) => (i % every === 0 || i === days.length - 1) && <text key={d.day} x={x(i)} y={H - 6} textAnchor="middle" className="fill-current text-muted" fontSize={11}>{dlabel(d.day)}</text>)}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="currentColor" className="text-muted" strokeWidth={1} strokeDasharray="3 3" />}
        <path d={line(spend)} fill="none" stroke="var(--s2)" strokeWidth={2} strokeLinejoin="round" />
        <path d={line(sales)} fill="none" stroke="var(--s1)" strokeWidth={2} strokeLinejoin="round" />
        {hover != null && <>
          <circle cx={x(hover)} cy={y(spend[hover])} r={4} fill="var(--s2)" stroke="var(--surface, #fff)" strokeWidth={2} />
          <circle cx={x(hover)} cy={y(sales[hover])} r={4} fill="var(--s1)" stroke="var(--surface, #fff)" strokeWidth={2} />
        </>}
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-6 right-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
          <b>{dlabel(h.day)}</b>
          <div>Ventas: {usd(h.ingresos, 2)} ({h.ventas})</div>
          <div>Gasto Meta: {usd(h.meta?.spend ?? 0, 2)}</div>
          <div className="text-muted">Cuentas nuevas: {h.cuentas}</div>
        </div>
      )}
    </div>
  );
}

export default function Campanas() {
  const [preset, setPreset] = useState("7");
  const range = useMemo(() => PRESETS.find((p) => p.id === preset)!.r(), [preset]);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true); setErr("");
    const r = await fetch(`/api/admin/campanas?from=${range.from}&to=${range.to}`).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setBusy(false);
    if (!r?.ok || !j) return setErr(j?.error || "No se pudieron leer los datos.");
    setD(j);
  }, [range]);
  useEffect(() => { load(); }, [load]);
  // launch days move fast: refresh every 5 minutes while the page is open
  useEffect(() => { const t = setInterval(load, 300_000); return () => clearInterval(t); }, [load]);

  const t = d?.total;
  const roas = t ? ratio(t.ingresos, t.gasto) : null;
  // without Meta's spend there's no cost to show (a «US$0» would look like free customers)
  const hasSpend = Boolean(d?.meta.connected && t && t.gasto > 0);
  const cac = t && hasSpend ? ratio(t.gasto, t.ventas) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Resultados de campañas</h2>
          <p className="text-sm text-muted">Lo que gastas en Meta al lado de lo que de verdad pasa en Creads. Todo en dólares.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" onClick={() => setPreset(p.id)} aria-pressed={preset === p.id}
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${preset === p.id ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}>{p.name}</button>
          ))}
          <button type="button" onClick={load} disabled={busy} className="rounded-full border border-line px-3 py-1 text-sm text-muted hover:text-ink disabled:opacity-50">{busy ? "Actualizando…" : "↻ Actualizar"}</button>
        </div>
      </div>

      <DesdeCero onChange={load} />
      {err && <p className="text-sm text-bad">{err}</p>}
      {d && !d.meta.connected && (
        <p className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">{d.meta.error ? `Meta no respondió: ${d.meta.error}` : "Meta no está conectado: conecta la cuenta publicitaria en Marketing → Conexiones para ver el gasto."} Los datos de Creads sí están.</p>
      )}

      {t && <Rentable registros={t.cuentas} ventas={t.ventas} ingresosUsd={t.ingresos} regalosUsd={d.regalos ?? 0} gastoUsd={hasSpend ? t.gasto : null} />}

      {t && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Gasto en Meta" value={d.meta.connected ? usd(t.gasto, 2) : "—"} hint={`${int(t.clics)} clics · ${money(ratio(t.gasto, t.clics))} por clic`} />
            <Tile label="Ventas en Creads" value={usd(t.ingresos, 2)} hint={`${t.ventas} ${t.ventas === 1 ? "venta" : "ventas"} · ${t.ventasMeta} llegaron desde Meta`} />
            <Tile label="Retorno (ventas ÷ gasto)" value={roas == null ? "—" : `${roas.toLocaleString("es-CL", { maximumFractionDigits: 2 })}×`} hint={roas == null ? "Sin gasto en este período" : roas >= 1 ? "Las ventas ya pagan los anuncios" : "Las ventas todavía no cubren el gasto"} tone={roas == null ? undefined : roas >= 1 ? "good" : "bad"} />
            <Tile label="Costo por cliente" value={money(cac)} hint={hasSpend ? `Gasto ÷ ventas · ${money(ratio(t.gasto, t.cuentas))} por cuenta nueva` : "Aparece cuando Meta muestre el gasto"} />
          </div>

          <div className={card}>
            <h3 className="font-semibold">El camino del cliente</h3>
            <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Clics en anuncios", t.clics, null],
                ["Cuentas creadas", t.cuentas, ratio(t.cuentas, t.clics)],
                ["Abrieron el pago", t.pagosIniciados, ratio(t.pagosIniciados, t.cuentas)],
                ["Pagaron", t.ventas, ratio(t.ventas, t.pagosIniciados)],
              ].map(([k, n, r], i) => (
                <li key={String(k)} className="flex flex-col gap-0.5 rounded-xl bg-surface-2 p-3">
                  <span className="text-xs text-muted">{i + 1}. {k}</span>
                  <span className="font-display text-xl font-semibold tabular-nums">{int(Number(n))}</span>
                  {i > 0 && <span className="text-xs text-muted">{pct(r as number | null)} del paso anterior</span>}
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted">Clics vienen de Meta; cuentas, pagos y ventas vienen de Creads (son los números reales, de todas las fuentes).</p>
          </div>

          <div className={card}>
            <h3 className="font-semibold">Día a día</h3>
            {d.porDia.length > 1 ? <Chart days={d.porDia} /> : <p className="text-sm text-muted">Elige más de un día para ver la curva.</p>}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr><th className="py-2 font-semibold">Día</th><th className="font-semibold">Gasto Meta</th><th className="font-semibold">Clics</th><th className="font-semibold">Cuentas</th><th className="font-semibold">Abrieron pago</th><th className="font-semibold">Ventas</th><th className="font-semibold">US$ vendidos</th><th className="font-semibold">Retorno</th></tr>
                </thead>
                <tbody className="tabular-nums">
                  {[...d.porDia].reverse().map((x) => {
                    const r = ratio(x.ingresos, x.meta?.spend ?? 0);
                    return (
                      <tr key={x.day} className="border-t border-line">
                        <td className="py-2">{dlabel(x.day)}</td><td>{usd(x.meta?.spend ?? 0, 2)}</td><td>{int(x.meta?.clicks ?? 0)}</td><td>{x.cuentas}</td><td>{x.pagosIniciados}</td><td>{x.ventas}</td><td>{usd(x.ingresos, 2)}</td>
                        <td className={r == null ? "text-muted" : r >= 1 ? "text-good" : "text-bad"}>{r == null ? "—" : `${r.toFixed(2)}×`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className={card}>
            <h3 className="font-semibold">Por campaña (según Meta)</h3>
            <p className="text-xs text-muted">Registros, pagos y compras que Meta atribuye a cada campaña con el píxel. Pueden no calzar exacto con Creads (Meta cuenta hasta 7 días después del clic y solo a quienes aceptaron cookies).</p>
            {d.meta.campaigns.length === 0 ? <p className="text-sm text-muted">Sin campañas con gasto en este período.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr><th className="py-2 font-semibold">Campaña</th><th className="font-semibold">Estado</th><th className="font-semibold">Gasto</th><th className="font-semibold">Clics</th><th className="font-semibold">CTR</th><th className="font-semibold">Registros</th><th className="font-semibold">Compras</th><th className="font-semibold">Costo por registro</th><th className="font-semibold">Retorno</th></tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {d.meta.campaigns.map((c) => {
                      const r = ratio(c.buyValue, c.spend);
                      return (
                        <tr key={c.id} className="border-t border-line">
                          <td className="max-w-56 truncate py-2 font-semibold" title={c.nombre}>{c.nombre}</td>
                          <td className="text-xs">{ESTADO[c.estado] ?? (c.estado || "—")}</td>
                          <td>{usd(c.spend, 2)}</td><td>{int(c.clicks)}</td><td>{pct(ratio(c.clicks, c.impressions))}</td><td>{c.regs}</td><td>{c.buys}</td>
                          <td>{money(ratio(c.spend, c.regs))}</td>
                          <td className={r == null ? "text-muted" : r >= 1 ? "text-good" : "text-bad"}>{r == null ? "—" : `${r.toFixed(2)}×`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <p className="text-xs text-muted">Se actualiza solo cada 5 minutos. Ventas en US$ como las pagó el cliente (IVA incluido); las renovaciones mensuales no están incluidas todavía.</p>
        </>
      )}
      {!d && !err && <p className="text-sm text-muted">Cargando…</p>}
    </div>
  );
}
