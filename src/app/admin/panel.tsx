"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Config,
  type CostoFijo,
  type Finanzas,
  type Movimiento,
  type Plan,
  type PlanMonth,
  DEFAULT_FINANZAS,
  fijoMensual,
  planMonth,
  proyectar,
  toUsd,
} from "@/lib/finance";

// The owner's control room: money, models, accounts, sign-ups and service status in one place.

type Tab = "lanzamiento" | "errores" | "resumen" | "saldos" | "clientes" | "planes" | "movs" | "fijos" | "modelos" | "cuentas" | "registros" | "estado";
const TABS: [Tab, string][] = [
  ["lanzamiento", "Lanzamiento"],
  ["errores", "Errores y alarmas"],
  ["resumen", "Resumen"],
  ["saldos", "Saldos y alertas"],
  ["clientes", "Clientes y accesos"],
  ["planes", "Planes y afiliados"],
  ["movs", "Movimientos"],
  ["fijos", "Costos fijos"],
  ["modelos", "Costo por modelo"],
  ["cuentas", "Cuentas y accesos"],
  ["registros", "Registros"],
  ["estado", "Estado"],
];

const fmtUsd = (n: number, d = 0) =>
  `${n < 0 ? "−" : ""}US$${Math.abs(n).toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const fmtClp = (n: number) => `${n < 0 ? "−" : ""}$${Math.round(Math.abs(n)).toLocaleString("es-CL")}`;
const fmtPct = (n: number) => `${isFinite(n) ? Math.round(n) : 0}%`;
const tone = (m: number) => (m >= 50 ? "good" : m >= 30 ? "warn" : "bad");
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()));

const pillCls: Record<string, string> = {
  good: "bg-good/15 text-good",
  warn: "bg-warn/15 text-warn",
  bad: "bg-bad/15 text-bad",
  acc: "bg-accent/15 text-accent-text",
  "": "bg-surface-2 text-muted",
};
function Pill({ t = "", children }: { t?: string; children: React.ReactNode }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${pillCls[t]}`}>{children}</span>;
}

const card = "flex min-w-0 flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const th = "whitespace-nowrap border-b border-line px-3 py-2 text-left text-xs font-semibold tracking-wide text-muted uppercase";
const td = "border-b border-line px-3 py-2 align-top";
const num = "font-mono tabular-nums";
const input = "min-w-0 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-ink";
const btn = "rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted">{label}{children}</label>;
}
function Num({ id, value, onChange, step = 1, min = 0, max }: { id: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <input id={id} type="number" value={value} step={step} min={min} max={max} className={`${input} w-28 ${num}`} onFocus={(e) => e.target.select()}
      onChange={(e) => { const v = Number(e.target.value); if (isFinite(v)) onChange(v); }} />
  );
}
function Stat({ label, value, sub, t }: { label: string; value: string; sub?: string; t?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 rounded-xl p-4 ${t === "warn" ? "bg-warn/10" : "bg-surface-2"}`}>
      <span className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</span>
      <span className={`${num} text-2xl font-bold ${t && t !== "warn" ? `text-${t}` : ""}`}>{value}</span>
      {sub && <span className="text-sm text-muted">{sub}</span>}
    </div>
  );
}
function Split({ r }: { r: PlanMonth }) {
  const t = Math.max(r.precio, 0.01), w = (v: number) => `${(Math.max(0, v) / t) * 100}%`;
  return (
    <div className="flex h-2.5 w-full min-w-32 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`Te queda ${fmtPct(r.margen)}`}>
      <i className="block bg-accent" style={{ width: w(r.queda) }} />
      <i className="block bg-ink/40" style={{ width: w(r.iva) }} />
      <i className="block bg-muted" style={{ width: w(r.modelos) }} />
      <i className="block bg-warn" style={{ width: w(r.stripe) }} />
      <i className="block bg-bad" style={{ width: w(r.afiliado) }} />
    </div>
  );
}
function Del({ onDelete }: { onDelete: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 3000); return () => clearTimeout(t); }, [armed]);
  return (
    <button type="button" onClick={() => (armed ? onDelete() : setArmed(true))} className={`text-xs ${armed ? "font-semibold text-bad" : "text-muted hover:text-bad"}`}>
      {armed ? "¿Seguro?" : "Borrar"}
    </button>
  );
}

export default function AdminPanel() {
  const [tab, setTab] = useState<Tab>("lanzamiento");
  const [data, setData] = useState<Finanzas | null>(null);
  const [status, setStatus] = useState("Cargando…");
  const saveT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      // a link from an alarm email (?tab=errores) wins over the last tab used
      const t = (new URLSearchParams(location.search).get("tab") ?? localStorage.getItem("admin-tab")) as Tab | null;
      if (t && TABS.some(([k]) => k === t)) setTab(t);
    } catch {}
    fetch("/api/admin/finanzas")
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setData(d); setStatus(d.actualizado ? `Guardado ${new Date(d.actualizado).toLocaleString("es-CL")}` : "Datos iniciales (aún no guardados)"); })
      .catch((e) => setStatus(e.message || "No se pudo cargar."));
  }, []);
  const pick = (t: Tab) => { setTab(t); try { localStorage.setItem("admin-tab", t); } catch {} };

  /** Update locally right away, save to the server a moment later. */
  const change = useCallback((fn: (d: Finanzas) => Finanzas) => {
    setData((prev) => {
      if (!prev) return prev;
      const next = fn(structuredClone(prev));
      if (saveT.current) clearTimeout(saveT.current);
      setStatus("Guardando…");
      saveT.current = setTimeout(async () => {
        const res = await fetch("/api/admin/finanzas", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(next) });
        const d = await res.json().catch(() => ({}));
        setStatus(res.ok ? `Guardado ${new Date(d.actualizado).toLocaleString("es-CL")}` : d.error || "No se pudo guardar.");
      }, 700);
      return next;
    });
  }, []);
  const setCfg = (fn: (c: Config) => void) => change((d) => { fn(d.config); return d; });

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/app";
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Control de Creads</h1>
          <p className="text-sm text-muted">{status}</p>
        </div>
        <div className="flex items-end gap-3">
          {data && (
            <>
              <Field label="Dólar de respaldo (CLP)"><Num id="usdclp" value={data.config.usdClp} step={5} onChange={(v) => setCfg((c) => { c.usdClp = v || 950; })} /></Field>
              <Field label="Colchón de cambio (%)"><Num id="colchon" value={data.config.cambioColchon ?? 2} step={0.5} max={10} onChange={(v) => setCfg((c) => { c.cambioColchon = v; })} /></Field>
            </>
          )}
          <button type="button" onClick={logout} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink">Salir</button>
        </div>
      </div>

      <nav aria-label="Secciones" className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto border-b border-line bg-bg px-1 py-2">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" onClick={() => pick(k)} aria-current={tab === k ? "page" : undefined}
            className={`flex-none rounded-full px-3 py-1.5 text-sm font-semibold ${tab === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </nav>

      {/* tabs that load their own data render the same way before and after the money data arrives
          (so they don't mount twice) */}
      {tab === "lanzamiento" ? <Lanzamiento /> : tab === "errores" ? <Errores /> : tab === "saldos" ? <Saldos /> : tab === "registros" ? <Registros /> : tab === "estado" ? <Estado /> : !data ? (
        tab === "clientes" ? <Clientes planes={DEFAULT_FINANZAS.config.planes} /> : <div className={card}><p className="text-muted">{status}</p></div>
      ) : (
        <>
          {tab === "resumen" && <Resumen d={data} setCfg={setCfg} />}
          {tab === "planes" && <Planes d={data} setCfg={setCfg} />}
          {tab === "movs" && <Movimientos d={data} change={change} />}
          {tab === "fijos" && <Fijos d={data} change={change} setCfg={setCfg} />}
          {tab === "modelos" && <Modelos d={data} change={change} />}
          {tab === "cuentas" && <Cuentas d={data} />}
          {tab === "clientes" && <Clientes planes={data.config.planes} />}
        </>
      )}
    </div>
  );
}

type SetCfg = (fn: (c: Config) => void) => void;
type Change = (fn: (d: Finanzas) => Finanzas) => void;

// ---------- Resumen ----------
function Resumen({ d, setCfg }: { d: Finanzas; setCfg: SetCfg }) {
  const c = d.config;
  const f = fijoMensual(d.fijos);
  const gastado = d.movimientos.filter((m) => m.tipo !== "ingreso").reduce((a, m) => a + toUsd(m, c.usdClp), 0);
  const ingresos = d.movimientos.filter((m) => m.tipo === "ingreso").reduce((a, m) => a + toUsd(m, c.usdClp), 0);
  const faltan = d.movimientos.filter((m) => m.monto == null).length + d.fijos.filter((x) => x.montoUsd == null && x.estado !== "cancelar").length;
  const avg = c.planes.reduce((a, p) => a + planMonth(c, p, {}).queda, 0) / Math.max(1, c.planes.length);
  const eq = avg > 0 ? Math.ceil(f / avg) : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Stat label="Costos fijos al mes" value={fmtUsd(f)} sub={fmtClp(f * c.usdClp)} />
        <Stat label="Invertido hasta hoy" value={fmtUsd(gastado)} sub={`${fmtClp(gastado * c.usdClp)} en pagos y recargas`} />
        <Stat label="Ingresos registrados" value={fmtUsd(ingresos)} sub={ingresos ? fmtClp(ingresos * c.usdClp) : "Todavía sin clientes pagando"} />
        <Stat label="Para cubrir los fijos" value={`${eq} suscriptores`} sub="promedio de los 3 planes" />
        {faltan > 0 && <Stat label="Por completar" value={String(faltan)} sub="montos sin anotar" t="warn" />}
      </div>

      <Proyeccion d={d} setCfg={setCfg} />
    </div>
  );
}

/** Monthly projection: subscribers per plan → what's left. `withFixed` also takes off the fixed costs. */
function Proyeccion({ d, setCfg, withFixed = false }: { d: Finanzas; setCfg: SetCfg; withFixed?: boolean }) {
  const c = d.config;
  const p = proyectar(d);
  const fijos = withFixed ? fijoMensual(d.fijos) : 0;
  const neto = p.neto - fijos;
  const margen = p.mrr ? (neto / p.mrr) * 100 : 0;
  const rows: [string, number][] = [["Ingresos (MRR)", p.mrr], ["IVA (va al SII)", -p.iva], ["Modelos de IA", -p.modelos], ["Stripe", -p.stripe], ["Afiliados", -p.afiliados], ...(withFixed ? [["Costos fijos", -fijos] as [string, number]] : [])];
  return (
      <section className={card}>
      <div>
        <h2 className="font-display text-xl font-bold">{withFixed ? "Proyección con costos fijos" : "Proyección mensual"}</h2>
        <p className="text-sm text-muted">{withFixed ? "Lo mismo que en Resumen, pero restando también los costos fijos: cuánto queda de verdad a fin de mes. Sirve para probar ofertas, afiliados y metas de suscriptores." : "Cambia cuántos suscriptores tienes y mira cuánto dejan las suscripciones después de modelos de IA, Stripe y afiliados. Los costos fijos van aparte (pestaña «Costos fijos»)."}</p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="% en su primer mes (−50%)"><Num id="p-promo" value={c.proyeccion.pctPromo ?? 100} step={10} max={100} onChange={(v) => setCfg((x) => { x.proyeccion.pctPromo = v; })} /></Field>
        {c.planes.map((pl) => (
          <Field key={pl.id} label={pl.nombre}><Num id={`p-${pl.id}`} value={c.proyeccion[pl.id] ?? 0} onChange={(v) => setCfg((x) => { x.proyeccion[pl.id] = v; })} /></Field>
        ))}
        <Field label="% de créditos que usan"><Num id="p-uso" value={c.uso} step={5} max={100} onChange={(v) => setCfg((x) => { x.uso = v; })} /></Field>
        <Field label="IVA %"><Num id="p-iva" value={c.ivaPct ?? 19} step={1} max={30} onChange={(v) => setCfg((x) => { x.ivaPct = v; })} /></Field>
        <Field label="% de ventas en Chile"><Num id="p-cl" value={c.pctChile ?? 100} step={10} max={100} onChange={(v) => setCfg((x) => { x.pctChile = v; })} /></Field>
        <Field label="% que llegó por afiliado"><Num id="p-af" value={c.proyeccion.pctAfiliado} step={5} max={100} onChange={(v) => setCfg((x) => { x.proyeccion.pctAfiliado = v; })} /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {rows.map(([l, v]) => (
                <tr key={l}><td className={td}>{l}</td><td className={`${td} ${num} text-right`}>{fmtUsd(v)}</td><td className={`${td} ${num} text-right text-muted`}>{fmtClp(v * c.usdClp)}</td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td className="px-3 py-2">{withFixed ? "Utilidad neta al mes" : "Te queda al mes (antes de fijos)"}</td>
                <td className={`px-3 py-2 text-right ${num} ${neto >= 0 ? "text-good" : "text-bad"}`}>{fmtUsd(neto)}</td>
                <td className={`px-3 py-2 text-right ${num} ${neto >= 0 ? "text-good" : "text-bad"}`}>{fmtClp(neto * c.usdClp)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="flex flex-col gap-3">
          <Stat label={withFixed ? "Margen neto real" : "Margen de las suscripciones"} value={fmtPct(margen)} sub={`${p.subs} suscriptores · ${fmtUsd(neto * 12)} al año`} t={tone(margen)} />
          <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
            Los precios incluyen IVA: el {c.ivaPct ?? 19}% de las ventas en Chile ({c.pctChile ?? 100}% del total) va al SII. Supone que el {c.proyeccion.pctPromo ?? 100}% está en su primer mes pagando la mitad (al lanzar son todos; después baja a los nuevos de cada mes), que usan el {c.uso}% de sus créditos y que el {c.proyeccion.pctAfiliado}% llegó por un afiliado con comisión{" "}
            {c.afiliado.tipo === "recurrente" ? `de ${c.afiliado.pct}% mensual` : "única (no entra en el mes a mes)"}.
          </p>
        </div>
      </div>
    </section>
  );
}

// ---------- Errores y alarmas ----------
interface ErrGroupV { sig: string; area: string; message: string; count: number; first: string; last: string; refs: string[]; paths: string[]; resolved: boolean }
interface GenRowV { label: string; total: number; failed: number; rate: number; failedUsd: number }
interface GenV { hours: number; total: number; failed: number; rate: number; failedUsd: number; refunded: number; rows: GenRowV[] }
const AREA: Record<string, string> = { servidor: "Servidor", navegador: "Navegador", generacion: "Generación", pagos: "Pagos", correo: "Correo", cron: "Tareas diarias" };
const when = (iso: string) => new Date(iso).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Errores() {
  const [d, setD] = useState<{ groups: ErrGroupV[]; g24: GenV; g7: GenV; alarms: { email: string | null; ready: boolean } } | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [range, setRange] = useState<"g24" | "g7">("g24");
  const load = () => fetch("/api/admin/errores").then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setErr(e.message || "No se pudo cargar."));
  useEffect(() => { load(); }, []);
  async function act(body: Record<string, string>) {
    setMsg("");
    const r = await fetch("/api/admin/errores", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (body.action === "probar") setMsg(j.ok ? "Listo: revisa tu correo." : j.error || "No se pudo enviar.");
    else load();
  }
  if (err) return <div className={card}><p className="text-bad">{err}</p></div>;
  if (!d) return <div className={card}><p className="text-muted">Cargando…</p></div>;
  const g = d[range];
  const open = d.groups.filter((x) => !x.resolved);
  const shown = showResolved ? d.groups : open;
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Alarmas</h2>
            <p className="text-sm text-muted">Te llega un correo cuando aparece un error nuevo, cuando vuelve uno que marcaste como resuelto, o cuando fallan muchas generaciones (más del 20% en 24 h, o un modelo con más del 40%). Como máximo uno cada 6 horas por problema y 20 al día.</p>
          </div>
          <button type="button" onClick={() => act({ action: "probar" })} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">Enviarme una alarma de prueba</button>
        </div>
        <p className="text-sm">{d.alarms.ready && d.alarms.email ? <>Se envían a <b>{d.alarms.email}</b>.</> : <span className="text-bad">No se pueden enviar: {d.alarms.ready ? "no hay correo del dueño" : "falta RESEND_API_KEY en Vercel"}.</span>}</p>
        {msg && <p className="text-sm text-muted">{msg}</p>}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Generaciones</h2>
          <div className="flex rounded-lg border border-line p-0.5 text-sm">
            {([["g24", "Últimas 24 h"], ["g7", "7 días"]] as const).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setRange(k)} className={`rounded-md px-3 py-1 font-semibold ${range === k ? "bg-ink text-bg" : "text-muted"}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
          <Stat label="Generaciones" value={g.total.toLocaleString("es-CL")} />
          <Stat label="Fallidas" value={`${g.failed} · ${pct(g.rate)}`} t={g.rate >= 0.2 ? "bad" : g.rate >= 0.1 ? "warn" : "good"} />
          <Stat label="Costo de lo fallido" value={fmtUsd(g.failedUsd, 2)} sub="si el proveedor igual cobró" />
          <Stat label="Créditos devueltos" value={g.refunded.toLocaleString("es-CL")} sub="a clientes, por fallas" />
        </div>
        {g.rows.length > 0 ? (
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>{["Modelo o herramienta", "Total", "Fallidas", "% falla", "Costo de lo fallido"].map((h, i) => <th key={h} className={`${th} ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.label}>
                    <td className={td}>{r.label}</td>
                    <td className={`${td} ${num} text-right`}>{r.total}</td>
                    <td className={`${td} ${num} text-right`}>{r.failed}</td>
                    <td className={`${td} text-right`}><Pill t={r.rate >= 0.4 ? "bad" : r.rate >= 0.15 ? "warn" : "good"}>{pct(r.rate)}</Pill></td>
                    <td className={`${td} ${num} text-right`}>{fmtUsd(r.failedUsd, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-muted">Sin generaciones en este período.</p>}
        <p className="text-xs text-muted">«Costo de lo fallido» es lo que habría costado cada trabajo fallido. Algunos proveedores no cobran lo que rechazan; compáralo con sus facturas para saber la pérdida real.</p>
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Errores de los últimos 7 días</h2>
            <p className="text-sm text-muted">Agrupados por tipo. El código de referencia es el mismo que ve el cliente, así lo encuentras si te escribe.</p>
          </div>
          <div className="flex items-center gap-3">
            <Pill t={open.length ? "warn" : "good"}>{open.length ? `${open.length} sin resolver` : "Todo resuelto"}</Pill>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />Ver resueltos</label>
            <button type="button" onClick={load} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">Actualizar</button>
          </div>
        </div>
        {shown.length === 0 ? <p className="text-sm text-muted">No hay errores{showResolved ? "" : " sin resolver"}. 🎉</p> : (
          <ul className="flex flex-col gap-2">
            {shown.map((x) => (
              <li key={x.sig} className={`flex flex-col gap-1.5 rounded-xl px-4 py-3 ${x.resolved ? "bg-surface-2 opacity-60" : "bg-surface-2"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><Pill t={x.area === "navegador" ? "acc" : "warn"}>{AREA[x.area] ?? x.area}</Pill><b className="text-sm">{x.count} {x.count === 1 ? "vez" : "veces"}</b><span className="text-xs text-muted">última: {when(x.last)}</span></span>
                  {!x.resolved && <button type="button" onClick={() => act({ action: "resolver", sig: x.sig })} className="text-xs font-semibold text-muted hover:text-ink">Marcar como resuelto</button>}
                </div>
                <p className="break-words font-mono text-xs">{x.message}</p>
                {(x.paths.length > 0 || x.refs.length > 0) && <p className="text-xs text-muted">{x.paths.length > 0 && <>Dónde: {x.paths.join(", ")} </>}{x.refs.length > 0 && <>· Códigos: {x.refs.join(", ")}</>}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------- Planes y afiliados ----------
function Planes({ d, setCfg }: { d: Finanzas; setCfg: SetCfg }) {
  const c = d.config;
  const [o, setO] = useState({ anual: false, promo: false, viaAf: false });
  const a = c.afiliado;
  const af = c.planes.map((p) => {
    const base = planMonth(c, p, {});
    const pagoMes = a.tipo === "recurrente" ? (base.precio * a.pct) / 100 : 0;
    const total = a.tipo === "recurrente" ? pagoMes * Math.min(a.meses, a.vida) : a.cpa;
    const bruto = base.queda * a.vida;
    return { p, pagoMes, total, bruto, neto: bruto - total, ok: bruto - total > 0 && bruto * 0.5 > total };
  });

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <h2 className="font-display text-xl font-bold">Margen por plan, por cliente</h2>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Costo real por crédito (US$)"><Num id="cc" value={c.costoCredito} step={0.001} onChange={(v) => setCfg((x) => { x.costoCredito = v; })} /></Field>
          <Field label="Límite diario cuentas nuevas, primeras 48 h (US$, 0 = sin límite)"><Num id="ln" value={c.limiteNuevas ?? 25} step={5} onChange={(v) => setCfg((x) => { x.limiteNuevas = v; })} /></Field>
          <Field label="% de créditos usados"><Num id="uso" value={c.uso} step={5} max={100} onChange={(v) => setCfg((x) => { x.uso = v; })} /></Field>
          <Field label="Comisión Stripe %"><Num id="stp" value={c.stripePct} step={0.1} onChange={(v) => setCfg((x) => { x.stripePct = v; })} /></Field>
          {([["anual", "Pago anual"], ["promo", "Primer mes con 50% dcto."], ["viaAf", "Llegó por afiliado"]] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={o[k]} onChange={(e) => setO({ ...o, [k]: e.target.checked })} /> {l}
            </label>
          ))}
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{["Plan", "Precio/mes", "IVA", "Modelos de IA", "Stripe", "Afiliado", "Te queda", "Margen", "Reparto"].map((h, i) => <th key={h} className={`${th} ${i && i < 8 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {c.planes.map((p) => {
                const r = planMonth(c, p, o);
                return (
                  <tr key={p.id}>
                    <td className={td}><strong>{p.nombre}</strong><br /><span className="text-xs text-muted">{p.creditos.toLocaleString("es-CL")} créditos</span></td>
                    <td className={`${td} ${num} text-right`}>{fmtUsd(r.precio, 2)}</td>
                    <td className={`${td} ${num} text-right`}>{fmtUsd(r.iva, 2)}</td>
                    <td className={`${td} ${num} text-right`}>{fmtUsd(r.modelos, 2)}</td>
                    <td className={`${td} ${num} text-right`}>{fmtUsd(r.stripe, 2)}</td>
                    <td className={`${td} ${num} text-right`}>{fmtUsd(r.afiliado, 2)}</td>
                    <td className={`${td} ${num} text-right`}><strong>{fmtUsd(r.queda, 2)}</strong><br /><span className="text-xs text-muted">{fmtClp(r.queda * c.usdClp)}</span></td>
                    <td className={`${td} text-right`}><Pill t={tone(r.margen)}>{fmtPct(r.margen)}</Pill></td>
                    <td className={td}><Split r={r} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted">
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-accent align-[-1px]" />Te queda</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-muted align-[-1px]" />Modelos de IA</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-warn align-[-1px]" />Stripe</span>
          <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-bad align-[-1px]" />Afiliado</span>
        </div>
        <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">El costo por crédito es el del modelo más caro por crédito más un 15% por rehacer cortes que fallan. Así el margen mostrado es el peor caso.</p>
      </section>

      <section className={card}>
        <div>
          <h2 className="font-display text-xl font-bold">Programa de afiliados</h2>
          <p className="text-sm text-muted">El afiliado corre Creads como oferta y cobra por cada suscriptor que trae. Así la plataforma crece sin poner nuestro dinero en publicidad.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Tipo de pago">
            <select id="af-tipo" value={a.tipo} className={input} onChange={(e) => setCfg((x) => { x.afiliado.tipo = e.target.value as "recurrente" | "cpa"; })}>
              <option value="recurrente">Recurrente: % de cada mes</option>
              <option value="cpa">Pago único por suscriptor (CPA)</option>
            </select>
          </Field>
          {a.tipo === "recurrente" ? (
            <>
              <Field label="% por mes"><Num id="af-pct" value={a.pct} step={5} max={100} onChange={(v) => setCfg((x) => { x.afiliado.pct = v; })} /></Field>
              <Field label="Durante (meses)"><Num id="af-meses" value={a.meses} min={1} max={60} onChange={(v) => setCfg((x) => { x.afiliado.meses = v; })} /></Field>
            </>
          ) : (
            <Field label="CPA (US$ por suscriptor)"><Num id="af-cpa" value={a.cpa} step={5} onChange={(v) => setCfg((x) => { x.afiliado.cpa = v; })} /></Field>
          )}
          <Field label="Meses que se queda un cliente"><Num id="vida" value={a.vida} min={1} max={60} onChange={(v) => setCfg((x) => { x.afiliado.vida = Math.max(1, v); })} /></Field>
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr>{["Plan", "Afiliado gana", "Total al afiliado", "Te deja el cliente (sin afiliado)", "Te deja (con afiliado)", "¿Conviene?"].map((h, i) => <th key={h} className={`${th} ${i && i < 5 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {af.map((x) => (
                <tr key={x.p.id}>
                  <td className={td}><strong>{x.p.nombre}</strong></td>
                  <td className={`${td} ${num} text-right`}>{a.tipo === "recurrente" ? `${fmtUsd(x.pagoMes, 2)}/mes` : `${fmtUsd(a.cpa)} una vez`}</td>
                  <td className={`${td} ${num} text-right`}>{fmtUsd(x.total)}</td>
                  <td className={`${td} ${num} text-right`}>{fmtUsd(x.bruto)}</td>
                  <td className={`${td} ${num} text-right font-bold ${x.neto > 0 ? "text-good" : "text-bad"}`}>{fmtUsd(x.neto)}</td>
                  <td className={td}><Pill t={x.ok ? "good" : "warn"}>{x.ok ? "Sí, sobra margen" : "Ajustar"}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
          Cálculo sobre la vida de un cliente ({a.vida} meses, pago mensual). «Sí, sobra margen» significa que el afiliado se lleva menos de la mitad de lo que deja el cliente.
          Los afiliados de software suelen pagar entre 20% y 40% recurrente por 12 meses.
        </p>
      </section>
    </div>
  );
}

// ---------- Movimientos ----------
function Movimientos({ d, change }: { d: Finanzas; change: Change }) {
  const c = d.config;
  const today = new Date().toISOString().slice(0, 10);
  const blank = { fecha: today, tipo: "gasto" as Movimiento["tipo"], servicio: "", detalle: "", monto: "", moneda: "USD" as Movimiento["moneda"] };
  const [f, setF] = useState(blank);
  const list = useMemo(() => [...d.movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha)), [d.movimientos]);
  const bal = list.reduce((a, m) => a + (m.tipo === "ingreso" ? toUsd(m, c.usdClp) : -toUsd(m, c.usdClp)), 0);
  const [editing, setEditing] = useState<string | null>(null);

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.servicio.trim()) return;
    const m: Movimiento = { id: newId(), fecha: f.fecha, tipo: f.tipo, servicio: f.servicio.trim(), detalle: f.detalle.trim(), monto: f.monto === "" ? null : Number(f.monto), moneda: f.moneda };
    change((x) => { x.movimientos.push(m); return x; });
    setF({ ...blank, fecha: f.fecha });
  }
  const setMonto = (id: string, v: string, moneda: Movimiento["moneda"]) =>
    change((x) => { const m = x.movimientos.find((y) => y.id === id); if (m) { m.monto = v === "" ? null : Number(v); m.moneda = moneda; } return x; });

  return (
    <section className={card}>
      <div>
        <h2 className="font-display text-xl font-bold">Movimientos</h2>
        <p className="text-sm text-muted">Todo lo que entra y sale: pagos, recargas de saldo e ingresos. Toca un monto amarillo para completarlo.</p>
      </div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-3">
        <Field label="Fecha"><input id="m-fecha" type="date" required value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} className={input} /></Field>
        <Field label="Tipo">
          <select id="m-tipo" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as Movimiento["tipo"] })} className={input}>
            <option value="gasto">Gasto</option><option value="recarga">Recarga de saldo</option><option value="ingreso">Ingreso</option>
          </select>
        </Field>
        <Field label="Servicio"><input id="m-serv" required value={f.servicio} placeholder="fal.ai" onChange={(e) => setF({ ...f, servicio: e.target.value })} className={`${input} w-44`} /></Field>
        <Field label="Detalle"><input id="m-det" value={f.detalle} placeholder="Saldo para pruebas" onChange={(e) => setF({ ...f, detalle: e.target.value })} className={`${input} w-56`} /></Field>
        <Field label="Monto"><input id="m-monto" type="number" step="0.01" min="0" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} className={`${input} w-28 ${num}`} /></Field>
        <Field label="Moneda">
          <select id="m-mon" value={f.moneda} onChange={(e) => setF({ ...f, moneda: e.target.value as Movimiento["moneda"] })} className={input}><option>USD</option><option>CLP</option></select>
        </Field>
        <button type="submit" className={btn}>Agregar</button>
      </form>
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>{["Fecha", "Tipo", "Servicio", "Detalle", "Monto", "En US$", ""].map((h, i) => <th key={i} className={`${th} ${i === 4 || i === 5 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id}>
                <td className={`${td} ${num}`}>{m.fecha}</td>
                <td className={td}><Pill t={m.tipo === "ingreso" ? "good" : m.tipo === "recarga" ? "acc" : ""}>{m.tipo}</Pill></td>
                <td className={`${td} font-semibold`}>{m.servicio}</td>
                <td className={`${td} text-muted`}>{m.detalle}</td>
                <td className={`${td} ${num} text-right`}>
                  {editing === m.id || m.monto == null ? (
                    <span className="inline-flex items-center gap-1">
                      <input aria-label={`Monto de ${m.servicio}`} type="number" step="0.01" min="0" defaultValue={m.monto ?? ""} autoFocus={editing === m.id}
                        className={`${input} w-24 ${num} ${m.monto == null ? "border-warn" : ""}`}
                        onBlur={(e) => { if (e.target.value !== String(m.monto ?? "")) setMonto(m.id, e.target.value, m.moneda); setEditing(null); }} />
                      <span className="text-xs text-muted">{m.moneda}</span>
                    </span>
                  ) : (
                    <button type="button" onClick={() => setEditing(m.id)} className="hover:underline">{m.moneda === "CLP" ? fmtClp(m.monto) : fmtUsd(m.monto, 2)}</button>
                  )}
                </td>
                <td className={`${td} ${num} text-right`}>{m.monto == null ? "—" : fmtUsd(toUsd(m, c.usdClp), 2)}</td>
                <td className={`${td} text-right`}><Del onDelete={() => change((x) => { x.movimientos = x.movimientos.filter((y) => y.id !== m.id); return x; })} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="font-bold"><td colSpan={5} className="px-3 py-2">Balance (ingresos − gastos)</td><td className={`px-3 py-2 text-right ${num} ${bal >= 0 ? "text-good" : "text-bad"}`}>{fmtUsd(bal, 2)}</td><td /></tr></tfoot>
        </table>
      </div>
    </section>
  );
}

// ---------- Costos fijos ----------
function Fijos({ d, change, setCfg }: { d: Finanzas; change: Change; setCfg: SetCfg }) {
  const c = d.config;
  const blank = { servicio: "", para: "", monto: "", frecuencia: "mensual" as CostoFijo["frecuencia"], estado: "activo" as CostoFijo["estado"] };
  const [f, setF] = useState(blank);
  const order = { activo: 0, pendiente: 1, cancelar: 2 };
  const list = [...d.fijos].sort((a, b) => order[a.estado] - order[b.estado] || a.servicio.localeCompare(b.servicio));
  const upd = (id: string, fn: (x: CostoFijo) => void) => change((x) => { const it = x.fijos.find((y) => y.id === id); if (it) fn(it); return x; });

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!f.servicio.trim()) return;
    const it: CostoFijo = { id: newId(), servicio: f.servicio.trim(), para: f.para.trim(), montoUsd: f.monto === "" ? null : Number(f.monto), frecuencia: f.frecuencia, estado: f.estado };
    change((x) => { x.fijos.push(it); return x; });
    setF(blank);
  }

  return (
    <div className="flex flex-col gap-4">
    <Proyeccion d={d} setCfg={setCfg} withFixed />
    <section className={card}>
      <div>
        <h2 className="font-display text-xl font-bold">Costos fijos</h2>
        <p className="text-sm text-muted">Lo que se paga todos los meses o todos los años, se use o no. Los anuales se dividen en 12. Puedes cambiar el monto y el estado directo en la tabla.</p>
      </div>
      <form onSubmit={add} className="flex flex-wrap items-end gap-3">
        <Field label="Servicio"><input id="x-serv" required value={f.servicio} placeholder="Stripe" onChange={(e) => setF({ ...f, servicio: e.target.value })} className={`${input} w-44`} /></Field>
        <Field label="Para qué"><input id="x-para" value={f.para} placeholder="Cobros" onChange={(e) => setF({ ...f, para: e.target.value })} className={`${input} w-52`} /></Field>
        <Field label="US$"><input id="x-monto" type="number" step="0.01" min="0" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} className={`${input} w-28 ${num}`} /></Field>
        <Field label="Cada"><select id="x-freq" value={f.frecuencia} onChange={(e) => setF({ ...f, frecuencia: e.target.value as CostoFijo["frecuencia"] })} className={input}><option value="mensual">Mes</option><option value="anual">Año</option></select></Field>
        <Field label="Estado"><select id="x-est" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value as CostoFijo["estado"] })} className={input}><option value="activo">Activo</option><option value="pendiente">Pendiente</option><option value="cancelar">Cancelar</option></select></Field>
        <button type="submit" className={btn}>Agregar</button>
      </form>
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>{["Servicio", "Para qué", "Monto (US$)", "Cada", "Al mes", "Estado", ""].map((h, i) => <th key={i} className={`${th} ${i === 4 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody>
            {list.map((x) => {
              const mes = x.montoUsd == null ? null : x.frecuencia === "anual" ? x.montoUsd / 12 : x.montoUsd;
              return (
                <tr key={x.id}>
                  <td className={td}><strong>{x.servicio}</strong>{x.nota && <><br /><span className="text-xs text-muted">{x.nota}</span></>}</td>
                  <td className={`${td} text-muted`}>{x.para}</td>
                  <td className={td}>
                    <input aria-label={`Monto de ${x.servicio}`} type="number" step="0.01" min="0" defaultValue={x.montoUsd ?? ""}
                      className={`${input} w-24 ${num} ${x.montoUsd == null && x.estado !== "cancelar" ? "border-warn" : ""}`}
                      onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== x.montoUsd) upd(x.id, (y) => { y.montoUsd = v; }); }} />
                  </td>
                  <td className={td}>
                    <select aria-label={`Frecuencia de ${x.servicio}`} value={x.frecuencia} className={input} onChange={(e) => upd(x.id, (y) => { y.frecuencia = e.target.value as CostoFijo["frecuencia"]; })}>
                      <option value="mensual">Mes</option><option value="anual">Año</option>
                    </select>
                  </td>
                  <td className={`${td} ${num} text-right`}>{mes == null ? "—" : fmtUsd(mes, 2)}<br /><span className="text-xs text-muted">{mes == null ? "" : fmtClp(mes * c.usdClp)}</span></td>
                  <td className={td}>
                    <select aria-label={`Estado de ${x.servicio}`} value={x.estado} className={input} onChange={(e) => upd(x.id, (y) => { y.estado = e.target.value as CostoFijo["estado"]; })}>
                      <option value="activo">Activo</option><option value="pendiente">Pendiente</option><option value="cancelar">Cancelar</option>
                    </select>
                  </td>
                  <td className={`${td} text-right`}><Del onDelete={() => change((y) => { y.fijos = y.fijos.filter((z) => z.id !== x.id); return y; })} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr className="font-bold"><td colSpan={4} className="px-3 py-2">Total al mes (sin los marcados «cancelar»)</td><td className={`px-3 py-2 text-right ${num}`}>{fmtUsd(fijoMensual(d.fijos), 2)}</td><td colSpan={2} /></tr></tfoot>
        </table>
      </div>
    </section>
    </div>
  );
}

// ---------- Modelos ----------
function Modelos({ d, change }: { d: Finanzas; change: Change }) {
  const target = d.config.costoCredito / 1.15;
  const unidad = { s: "segundo", img: "imagen", anuncio: "anuncio", "1k car": "1.000 caracteres" } as const;
  const list = [...d.modelos].sort((a, b) => a.tipo.localeCompare(b.tipo) || a.usd - b.usd);
  return (
    <section className={card}>
      <div>
        <h2 className="font-display text-xl font-bold">Costo por modelo</h2>
        <p className="text-sm text-muted">Lo que nos cobra cada proveedor y cuántos créditos le cobramos al cliente. Si un modelo nos cuesta más por crédito que el objetivo ({fmtUsd(target, 4)}), hay que subirle los créditos.</p>
      </div>
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>{["Modelo", "Proveedor", "Nos cuesta", "Cobramos (créditos)", "Costo por crédito", "Estado"].map((h, i) => <th key={h} className={`${th} ${i >= 2 && i <= 4 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody>
            {list.map((m) => {
              const cpc = m.creditos ? m.usd / m.creditos : null;
              return (
                <tr key={m.id}>
                  <td className={td}><strong>{m.nombre}</strong>{m.nota && <><br /><span className="text-xs text-muted">{m.nota}</span></>}</td>
                  <td className={`${td} text-muted`}>{m.proveedor}</td>
                  <td className={`${td} ${num} text-right`}>{fmtUsd(m.usd, 3)} <span className="text-xs text-muted">/ {unidad[m.unidad]}</span></td>
                  <td className={`${td} text-right`}>
                    <input aria-label={`Créditos de ${m.nombre}`} type="number" min="0" defaultValue={m.creditos} className={`${input} w-20 ${num}`}
                      onBlur={(e) => { const v = Number(e.target.value); if (isFinite(v) && v !== m.creditos) change((x) => { const it = x.modelos.find((y) => y.id === m.id); if (it) it.creditos = v; return x; }); }} />
                  </td>
                  <td className={`${td} ${num} text-right`}>{cpc == null ? "—" : fmtUsd(cpc, 4)}</td>
                  <td className={td}>{cpc == null ? <Pill>Incluido</Pill> : cpc <= target * 1.0001 ? <Pill t="good">OK</Pill> : <Pill t="bad">Subir créditos</Pill>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- Cuentas ----------
function Cuentas({ d }: { d: Finanzas }) {
  const est = { activa: "good", pendiente: "warn", cancelar: "bad" } as const;
  return (
    <section className={card}>
      <div>
        <h2 className="font-display text-xl font-bold">Cuentas y accesos</h2>
      </div>
      <p className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm"><strong>Nunca escribas claves aquí.</strong> Las claves viven solo en Vercel (Settings → Environment Variables). Esta tabla dice dónde está cada cosa, no la clave misma.</p>
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr>{["Servicio", "Para qué", "Cuenta", "Dónde está la clave", "Estado"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {[...d.cuentas].sort((a, b) => a.orden - b.orden).map((c) => (
              <tr key={c.id}>
                <td className={td}><strong>{c.servicio}</strong>{c.panel && <><br /><a href={c.panel} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-text underline">Abrir panel</a></>}</td>
                <td className={`${td} text-muted`}>{c.para}</td>
                <td className={td}>{c.cuenta}</td>
                <td className={td}>{c.clave ? <code className="rounded bg-surface-2 px-1 text-xs">{c.clave}</code> : <span className="text-muted">No usa clave</span>}{c.nota && <><br /><span className="text-xs text-muted">{c.nota}</span></>}</td>
                <td className={td}><Pill t={est[c.estado]}>{c.estado}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- Registros (waitlist) ----------
interface Registro { id: number; email: string; niche: string | null; ads_per_month: string | null; plan?: string | null; lang?: string | null; created_at: string }
function Registros() {
  const [rows, setRows] = useState<Registro[] | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    fetch("/api/admin/registros").then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error); setRows(d.rows); }).catch((e) => setErr(e.message || "No se pudo cargar."));
  }, []);
  const porPlan = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) { const k = (r.plan || "sin plan").replace("-yearly", " (anual)"); m[k] = (m[k] ?? 0) + 1; }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  async function copy() {
    const text = (rows ?? []).map((r) => r.email).join("\n");
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  }
  return (
    <section className={card}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Registros</h2>
          <p className="text-sm text-muted">Personas que reservaron un plan o se anotaron en creadsia.com.</p>
        </div>
        {rows && rows.length > 0 && <button type="button" onClick={copy} className="rounded-lg border border-line px-3 py-2 text-sm">{copied ? "Copiados" : "Copiar todos los correos"}</button>}
      </div>
      {err && <p className="text-sm text-bad">{err}</p>}
      {!rows && !err && <p className="text-muted">Cargando…</p>}
      {rows && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            <Stat label="Total" value={String(rows.length)} />
            {porPlan.slice(0, 5).map(([k, n]) => <Stat key={k} label={k} value={String(n)} />)}
          </div>
          {rows.length === 0 ? (
            <p className="py-6 text-center text-muted">Todavía nadie se ha anotado.</p>
          ) : (
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr>{["Fecha", "Correo", "Plan", "Nicho", "Anuncios/mes", "Idioma"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className={`${td} ${num} whitespace-nowrap`}>{new Date(r.created_at).toLocaleDateString("es-CL")}</td>
                      <td className={`${td} font-semibold`}>{r.email}</td>
                      <td className={td}>{r.plan ? <Pill t="acc">{r.plan.replace("-yearly", " · anual")}</Pill> : <span className="text-muted">—</span>}</td>
                      <td className={`${td} text-muted`}>{r.niche || "—"}</td>
                      <td className={`${td} text-muted`}>{r.ads_per_month || "—"}</td>
                      <td className={`${td} uppercase text-muted`}>{r.lang || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---------- Clientes ----------
// Only the owner reaches this panel. Each customer (or friend) gets a separate space; here the owner
// decides who gets in, what they can use (whole studio or only "Crear anuncio") and their discount.
interface Persona { id: string; email: string; name: string | null; role: string; active: boolean; last_login: string | null }
interface Cliente {
  id: string; name: string; kind: string; plan: string | null; active: boolean; created_at: string; usdMonth: number;
  access: "full" | "ads"; discount: number; people: Persona[]; balance: number; paid_until: string | null;
}
const ACCESS_LABEL = { full: "Acceso completo", ads: "Solo crear anuncios" } as const;

function Secret({ email, password, onClose }: { email: string; password: string; onClose: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-good/12 p-3 text-sm" role="status">
      <span><b>{email}</b> entra en creadsia.com/app con la clave temporal <b className="select-all font-mono">{password}</b>. Se muestra una sola vez: mándasela y que la cambie en «Mi cuenta».</span>
      <button type="button" onClick={onClose} className="text-xs text-muted hover:text-ink">Listo</button>
    </div>
  );
}

function ClienteCard({ c, reload, planes }: { c: Cliente; reload: () => void; planes: Plan[] }) {
  const [err, setErr] = useState("");
  const [secret, setSecret] = useState<{ email: string; password: string } | null>(null);
  const [add, setAdd] = useState({ email: "", name: "" });
  const [discount, setDiscount] = useState(c.discount);
  const call = async (url: string, method: string, body?: object) => {
    setErr("");
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setErr(d.error || "No se pudo."); return null; }
    return d;
  };
  const setWs = async (patch: object) => { if (await call("/api/admin/clientes", "PATCH", { id: c.id, ...patch })) reload(); };
  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    const d = await call("/api/admin/personas", "POST", { workspace: c.id, ...add });
    if (d) { setSecret({ email: add.email, password: d.password }); setAdd({ email: "", name: "" }); reload(); }
  }
  async function reset(p: Persona) {
    const d = await call("/api/admin/personas", "PATCH", { workspace: c.id, id: p.id, resetPassword: true });
    if (d) setSecret({ email: p.email, password: d.password });
  }
  async function remove(p: Persona) {
    if (!window.confirm(`¿Quitar a ${p.email}? Ya no podrá entrar.`)) return;
    if (await call(`/api/admin/personas?workspace=${encodeURIComponent(c.id)}&id=${p.id}`, "DELETE")) reload();
  }
  return (
    <article className={`${card} ${c.active ? "" : "opacity-70"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold">{c.name}</h3>
          <p className="font-mono text-xs text-muted">{c.id} · desde {new Date(c.created_at).toLocaleDateString("es-CL")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill t={c.active ? "good" : "warn"}>{c.active ? "Activo" : "Pausado"}</Pill>
          <Pill t="acc">{ACCESS_LABEL[c.access]}</Pill>
          {c.discount > 0 && <Pill>{c.discount}% dcto.</Pill>}
          <span className={`${num} text-sm`}>{fmtUsd(c.usdMonth, 2)} este mes</span>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Qué puede usar">
          <select value={c.access} onChange={(e) => setWs({ access: e.target.value })} className={input}>
            <option value="full">Acceso completo (todo el estudio)</option>
            <option value="ads">Solo crear anuncios</option>
          </select>
        </Field>
        <Field label="Descuento (%)">
          <span className="flex gap-2">
            <input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} className={`${input} w-24 ${num}`} />
            {discount !== c.discount && <button type="button" onClick={() => setWs({ discount })} className="rounded-lg border border-line px-3 text-sm">Guardar</button>}
          </span>
        </Field>
        <Field label="Acceso a la cuenta">
          <button type="button" onClick={() => setWs({ active: !c.active })} className="rounded-lg border border-line px-3 py-2 text-left text-sm">
            {c.active ? "Pausar (nadie de esta cuenta puede entrar)" : "Reactivar"}
          </button>
        </Field>
      </div>
      <Facturacion c={c} planes={planes} reload={reload} />
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-muted">Personas</span>
        {c.people.length === 0 && <p className="text-sm text-muted">Nadie todavía.</p>}
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {c.people.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0">
                <b className="break-all">{p.email}</b>{p.name ? <span className="text-muted"> · {p.name}</span> : null}
                <span className="block text-xs text-muted">{p.last_login ? `Última vez: ${new Date(p.last_login).toLocaleDateString("es-CL")}` : "Nunca ha entrado"}{p.active ? "" : " · pausada"}</span>
              </span>
              <span className="flex gap-3 text-xs">
                <button type="button" onClick={() => reset(p)} className="text-muted hover:text-ink">Nueva clave</button>
                <button type="button" onClick={async () => { if (await call("/api/admin/personas", "PATCH", { workspace: c.id, id: p.id, active: !p.active })) reload(); }} className="text-muted hover:text-ink">{p.active ? "Pausar" : "Reactivar"}</button>
                <button type="button" onClick={() => remove(p)} className="text-muted hover:text-bad">Quitar</button>
              </span>
            </li>
          ))}
        </ul>
        <form onSubmit={addPerson} className="flex flex-wrap items-end gap-2">
          <Field label="Agregar persona (correo)"><input required type="email" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} className={input} /></Field>
          <Field label="Nombre (opcional)"><input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} className={input} /></Field>
          <button type="submit" className="rounded-lg border border-line px-3 py-2 text-sm font-semibold">Agregar</button>
        </form>
      </div>
      {secret && <Secret email={secret.email} password={secret.password} onClose={() => setSecret(null)} />}
      {err && <p className="text-sm text-bad" role="alert">{err}</p>}
    </article>
  );
}

interface Mov { id: number; delta: number; kind: string; note: string | null; usd: number | null; by_user: string | null; created_at: string }
const MOV_KIND: Record<string, string> = { plan: "Pago de plan", topup: "Créditos agregados", charge: "Usó", refund: "Devuelto (falló)", adjust: "Créditos quitados" };

/** Credits, plan and payments of one customer (payments are recorded by hand for now). */
function Facturacion({ c, planes, reload }: { c: Cliente; planes: Plan[]; reload: () => void }) {
  const [mode, setMode] = useState<"" | "pago" | "agregar" | "quitar" | "historial">("");
  const [plan, setPlan] = useState(planes[0]?.id ?? "");
  const [months, setMonths] = useState(1);
  const [credits, setCredits] = useState(100);
  const [note, setNote] = useState("");
  const [ingreso, setIngreso] = useState(true);
  const [moves, setMoves] = useState<Mov[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const expired = c.paid_until && c.paid_until < today;
  const p = planes.find((x) => x.id === plan);
  const price = p ? (months === 12 ? p.anual * 12 : p.mensual * months) * (1 - c.discount / 100) : 0;

  async function send(body: object) {
    setBusy(true); setErr("");
    const r = await fetch("/api/admin/creditos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ws: c.id, ...body }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error || "No se pudo.");
    setMoves(d.history); setMode("historial"); setNote(""); reload();
  }
  async function showHistory() {
    setMode(mode === "historial" ? "" : "historial");
    if (mode !== "historial") {
      const r = await fetch(`/api/admin/creditos?ws=${encodeURIComponent(c.id)}`);
      const d = await r.json().catch(() => ({}));
      if (r.ok) setMoves(d.history); else setErr(d.error || "No se pudo leer.");
    }
  }
  const tab = (k: typeof mode, label: string) => (
    <button type="button" onClick={() => (k === "historial" ? showHistory() : setMode(mode === k ? "" : k))} aria-pressed={mode === k}
      className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${mode === k ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}>{label}</button>
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className={`${num} text-2xl font-bold ${c.balance <= 0 ? "text-warn" : ""}`}>{c.balance.toLocaleString("es-CL")}</span>
          <span className="text-sm text-muted">créditos</span>
          <span className="text-sm">{c.plan ? `Plan ${c.plan}` : "Sin plan"}{c.paid_until ? <> · <span className={expired ? "font-semibold text-bad" : ""}>{expired ? "venció" : "pagado hasta"} el {new Date(`${c.paid_until}T12:00:00`).toLocaleDateString("es-CL")}</span></> : " · sin vencimiento"}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tab("pago", "Registrar pago")}
          {tab("agregar", "Agregar créditos")}
          {tab("quitar", "Quitar")}
          {tab("historial", "Movimientos")}
        </div>
      </div>

      {mode === "pago" && (
        <form onSubmit={(e) => { e.preventDefault(); send({ action: "pago", plan, months, note, ingreso }); }} className="flex flex-wrap items-end gap-3">
          <Field label="Plan">
            <select value={plan} onChange={(e) => setPlan(e.target.value)} className={input}>
              {planes.map((x) => <option key={x.id} value={x.id}>{x.nombre} · {x.creditos.toLocaleString("es-CL")} créditos/mes · US${x.mensual}</option>)}
            </select>
          </Field>
          <Field label="Meses pagados">
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className={input}>
              {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m === 12 ? "12 (anual)" : m}</option>)}
            </select>
          </Field>
          <Field label="Nota (opcional)"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: pago acordado 16/10" className={input} /></Field>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" checked={ingreso} onChange={(e) => setIngreso(e.target.checked)} /> Anotar US${price.toFixed(0)} como ingreso</label>
          <button type="submit" disabled={busy || !p} className={btn}>{busy ? "Guardando…" : `Dar ${p ? (p.creditos * months).toLocaleString("es-CL") : 0} créditos`}</button>
        </form>
      )}
      {(mode === "agregar" || mode === "quitar") && (
        <form onSubmit={(e) => { e.preventDefault(); send({ action: mode, credits, note }); }} className="flex flex-wrap items-end gap-3">
          <Field label="Créditos"><input type="number" min={1} max={1000000} step={50} value={credits} onChange={(e) => setCredits(Number(e.target.value))} className={`${input} w-32 ${num}`} /></Field>
          <Field label="Motivo"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === "agregar" ? "Ej: regalo, compensación" : "Ej: corrección"} className={input} /></Field>
          <button type="submit" disabled={busy} className={btn}>{busy ? "Guardando…" : mode === "agregar" ? "Agregar" : "Quitar"}</button>
        </form>
      )}
      {mode === "historial" && (
        !moves ? <p className="text-sm text-muted">Cargando…</p> : moves.length === 0 ? <p className="text-sm text-muted">Sin movimientos todavía.</p> : (
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <tbody>
                {moves.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-0">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-muted">{new Date(m.created_at).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="py-1.5 pr-3">{MOV_KIND[m.kind] ?? m.kind}{m.note ? ` · ${m.note}` : ""}{m.usd ? <span className="text-muted"> · costo US${Number(m.usd).toFixed(2)}</span> : null}</td>
                    <td className={`py-1.5 text-right ${num} ${m.delta > 0 ? "text-good" : ""}`}>{m.delta > 0 ? "+" : ""}{m.delta.toLocaleString("es-CL")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {err && <p className="text-sm text-bad" role="alert">{err}</p>}
    </div>
  );
}

interface Pedido { id: string; ws: string; wsName: string; email: string; method: string; status: string; created: string; quote: { label: string; total: number; credits: number } }
const METHOD_LABEL: Record<string, string> = { tarjeta: "Tarjeta", mercadopago: "Mercado Pago", transferencia: "Transferencia" };

/** Orders customers placed from "Planes y créditos" (paid by hand until online payment is connected). */
function Pedidos({ reload }: { reload: () => void }) {
  const [list, setList] = useState<Pedido[] | null>(null);
  const [err, setErr] = useState("");
  const [all, setAll] = useState(false);
  const load = useCallback(() => { fetch("/api/admin/pedidos").then((r) => r.json()).then((d) => setList(d.orders ?? [])).catch(() => setList([])); }, []);
  useEffect(() => { load(); }, [load]);
  async function set(o: Pedido, status: "pagado" | "cancelado") {
    if (status === "pagado" && !window.confirm(`¿Confirmas que ${o.wsName} pagó ${fmtUsd(o.quote.total, 2)}? Se le dan ${o.quote.credits.toLocaleString("es-CL")} créditos y se anota el ingreso.`)) return;
    setErr("");
    const r = await fetch("/api/admin/pedidos", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: o.id, status }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error || "No se pudo.");
    load(); reload();
  }
  const open = (list ?? []).filter((o) => o.status === "pendiente");
  const shown = all ? list ?? [] : open;
  if (list && list.length === 0) return null;
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-bold">Pedidos de pago {open.length > 0 && <Pill t="warn">{open.length} por cobrar</Pill>}</h3>
        <button type="button" onClick={() => setAll(!all)} className="text-sm text-muted hover:text-ink">{all ? "Ver solo pendientes" : "Ver todos"}</button>
      </div>
      <p className="text-sm text-muted">Lo que tus clientes pidieron en «Planes y créditos». Con Mercado Pago conectado se pagan y activan solos; si alguno queda pendiente, puedes marcarlo como pagado a mano: los créditos y el ingreso se anotan solos.</p>
      {!list ? <p className="text-muted">Cargando…</p> : shown.length === 0 ? <p className="text-sm text-muted">No hay pedidos pendientes.</p> : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
          {shown.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span className="min-w-0">
                <b className="font-mono">{o.id}</b> · <b>{o.wsName}</b> · {o.quote.label} · <span className={num}>{fmtUsd(o.quote.total, 2)}</span>
                <span className="block text-xs text-muted">{o.email} · {METHOD_LABEL[o.method] ?? o.method} · {new Date(o.created).toLocaleString("es-CL")}</span>
              </span>
              {o.status === "pendiente" ? (
                <span className="flex gap-2">
                  <button type="button" onClick={() => set(o, "pagado")} className={btn}>Marcar pagado</button>
                  <button type="button" onClick={() => set(o, "cancelado")} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink">Cancelar</button>
                </span>
              ) : <Pill t={o.status === "pagado" ? "good" : ""}>{o.status === "pagado" ? "Pagado" : "Cancelado"}</Pill>}
            </li>
          ))}
        </ul>
      )}
      {err && <p className="text-sm text-bad" role="alert">{err}</p>}
    </section>
  );
}

function ImportarWinnerLab() {
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMsg("");
    try {
      const body = await file.text();
      const r = await fetch("/api/admin/importar", { method: "POST", headers: { "content-type": "application/json" }, body });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo importar.");
      const x = d.done;
      setMsg(`Listo: ${x.guiones} guiones, ${x.avatares} avatares, ${x.productos} productos, ${x.videos} videos con ${x.cortes} cortes y ${x.imagenes} imágenes${x.yaEstaban ? ` (${x.yaEstaban} ya estaban)` : ""}.`);
    } catch (e) { setMsg(e instanceof Error ? e.message : "No se pudo importar."); } finally { setBusy(false); }
  }
  return (
    <section className={card}>
      <h3 className="font-display text-lg font-bold">Traer lo de WinnerLab</h3>
      <p className="text-sm text-muted">Sube el archivo <b>winnerlab-import.json</b> que te mandé. Pasa a tu cuenta los guiones, avatares, productos, videos con sus cortes, anuncios terminados e imágenes del prototipo. Si lo subes dos veces, no duplica nada.</p>
      <label className={`${btn} w-fit cursor-pointer`}>
        {busy ? "Trayendo… (puede tardar un minuto)" : "Subir archivo"}
        <input type="file" accept="application/json,.json" className="sr-only" disabled={busy} onChange={(e) => pick(e.target.files?.[0])} />
      </label>
      {msg && <p className="text-sm" role="status">{msg}</p>}
    </section>
  );
}

function Clientes({ planes }: { planes: Plan[] }) {
  const [rows, setRows] = useState<Cliente[] | null>(null);
  const [err, setErr] = useState("");
  const [missing, setMissing] = useState(false);
  const [f, setF] = useState({ name: "", email: "", contact: "", access: "full", discount: 0, credits: 0 });
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ email: string; password: string } | null>(null);
  const load = useCallback(() => {
    fetch("/api/admin/clientes").then(async (r) => {
      const d = await r.json();
      if (!r.ok) { setMissing(Boolean(d.missing)); throw new Error(d.error); }
      setErr("");
      setRows(d.clientes);
    }).catch((e) => setErr(e.message || "No se pudo cargar."));
  }, []);
  useEffect(load, [load]);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/clientes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMade({ email: f.email, password: d.password });
      setF({ name: "", email: "", contact: "", access: "full", discount: 0, credits: 0 });
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo crear."); } finally { setBusy(false); }
  }
  const clients = (rows ?? []).filter((c) => c.kind === "client");
  const total = (rows ?? []).reduce((a, c) => a + c.usdMonth, 0);
  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div>
          <h2 className="font-display text-xl font-bold">Clientes y accesos</h2>
          <p className="text-sm text-muted">Cada cliente o amigo tiene su propio espacio: solo ve sus avatares, productos, guiones y videos. Solo tú puedes dar, cambiar o quitar accesos.</p>
        </div>
        {missing && <p className="rounded-lg bg-warn/12 p-3 text-sm">Falta activar las cuentas separadas en Supabase (el archivo tenancy.sql). Te dejé los pasos en el chat.</p>}
        {err && !missing && <p className="text-sm text-bad">{err}</p>}
        {rows && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            <Stat label="Clientes" value={String(clients.length)} />
            <Stat label="Activos" value={String(clients.filter((c) => c.active).length)} />
            <Stat label="Solo anuncios" value={String(clients.filter((c) => c.access === "ads").length)} />
            <Stat label="Gasto en modelos (mes)" value={fmtUsd(total, 2)} />
          </div>
        )}
      </section>

      <section className={card}>
        <h3 className="font-display text-lg font-bold">Dar acceso a alguien nuevo</h3>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre del cliente, empresa o amigo"><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} /></Field>
          <Field label="Correo para entrar"><input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} /></Field>
          <Field label="Qué puede usar">
            <select value={f.access} onChange={(e) => setF({ ...f, access: e.target.value })} className={input}>
              <option value="full">Acceso completo (todo el estudio)</option>
              <option value="ads">Solo crear anuncios</option>
            </select>
          </Field>
          <Field label="Descuento (%)"><input type="number" min={0} max={100} value={f.discount} onChange={(e) => setF({ ...f, discount: Number(e.target.value) })} className={`${input} w-28 ${num}`} /></Field>
          <Field label="Créditos para empezar (opcional, ej. 300 para que un amigo pruebe)"><input type="number" min={0} max={100000} step={50} value={f.credits} onChange={(e) => setF({ ...f, credits: Number(e.target.value) })} className={`${input} w-32 ${num}`} /></Field>
          <div className="sm:col-span-2"><button type="submit" disabled={busy} className={btn}>{busy ? "Creando…" : "Dar acceso"}</button></div>
        </form>
        {made && <Secret email={made.email} password={made.password} onClose={() => setMade(null)} />}
      </section>

      <Pedidos reload={load} />
      <ImportarWinnerLab />

      {!rows && !err && <p className="text-muted">Cargando…</p>}
      {clients.map((c) => <ClienteCard key={c.id} c={c} reload={load} planes={planes} />)}
      {rows && clients.length === 0 && <p className={`${card} text-muted`}>Todavía no has dado acceso a nadie.</p>}
    </div>
  );
}

// ---------- Estado de servicios ----------
interface Health { providers: { claude: boolean; video: Record<string, boolean>; image: Record<string, boolean>; voice: Record<string, boolean>; database: boolean } }
function Estado() {
  const [h, setH] = useState<Health | null>(null);
  useEffect(() => { fetch("/api/health").then((r) => r.json()).then(setH).catch(() => {}); }, []);
  const items: [string, boolean][] = h
    ? [
        ["Base de datos (Supabase)", h.providers.database],
        ["Claude", h.providers.claude],
        ...Object.entries(h.providers.image).map(([k, v]) => [k, v] as [string, boolean]),
        ...Object.entries(h.providers.video).map(([k, v]) => [k, v] as [string, boolean]),
        ...Object.entries(h.providers.voice).map(([k, v]) => [k, v] as [string, boolean]),
      ]
    : [];
  return (
    <section className={card}>
      <div>
        <h2 className="font-display text-xl font-bold">Estado de los servicios</h2>
        <p className="text-sm text-muted">Qué está conectado ahora mismo. «Falta la clave» significa que hay que agregarla en Vercel.</p>
      </div>
      {!h ? <p className="text-muted">Revisando…</p> : (
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2">
          {items.map(([k, ok]) => (
            <li key={k} className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
              <span className="font-semibold">{k}</span>
              <Pill t={ok ? "good" : "warn"}>{ok ? "Conectado" : "Falta la clave"}</Pill>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------- Lanzamiento ----------
// What's left before selling: the server checks what it can by itself; the rest is ticked by hand
// (remembered on this browser).
interface LaunchCheck { id: string; state: "ok" | "falta" | "revisar"; detail: string }
const AUTO: Record<string, { title: string; how: string }> = {
  billing: { title: "Base de datos de pagos (billing.sql)", how: "Supabase → SQL Editor → New query → pega todo supabase/billing.sql → Run. Se puede ejecutar más de una vez sin problema." },
  "mp-token": { title: "Mercado Pago: Access Token", how: "mercadopago.cl/developers → Tus integraciones → tu aplicación → Credenciales de producción → Access Token → Vercel: MP_ACCESS_TOKEN." },
  "mp-webhook": { title: "Mercado Pago: avisos de pago", how: "En tu aplicación → Webhooks: URL https://www.creadsia.com/api/pagos/mp, eventos Pagos y Planes y suscripciones → copia la clave secreta → Vercel: MP_WEBHOOK_SECRET." },
  "mp-once": { title: "Modo de cobro de los planes", how: "MP_ONE_TIME=1 cobra cada mes por separado (recomendado mientras uses una cuenta temporal)." },
  meta: { title: "Meta: API de conversiones (no es el píxel)", how: "El píxel ya está instalado. Este token deja que Creads avise las ventas a Meta desde el servidor (cuenta iPhone y bloqueadores). Administrador de eventos → tu píxel → Configuración → API de conversiones → Generar token de acceso → Vercel: META_CAPI_TOKEN → Redeploy. Hazlo antes de lanzar anuncios." },
  admin: { title: "Clave de administrador (llave maestra)", how: "Sirve para recuperar tu cuenta de dueño si pierdes la clave y el teléfono (en creadsia.com/app?dueno). Vercel → Environment Variables → ADMIN_ACCESS_CODE con 24 caracteres o más → guárdala en un lugar seguro → Redeploy." },
  email: { title: "Correos automáticos (Resend)", how: "Resend → API Keys → Vercel: RESEND_API_KEY." },
  cron: { title: "Avisos de plan por vencer", how: "Vercel: CRON_SECRET con una clave larga inventada." },
  dolar: { title: "Dólar automático", how: "Se lee solo del Banco Central cada día. Si falla, se usa el «Dólar de respaldo» de arriba en el Panel." },
  ai: { title: "Modelos de IA", how: "Claves de Anthropic, Google, fal.ai y ElevenLabs en Vercel." },
};
/** `urgent`: blocks the launch (shown in red). `who`: "tu" = the owner, "claude" = pending work of the AI developer. */
const MANUAL: { id: string; title: string; how: string; urgent?: boolean; who?: "tu" | "claude" }[] = [
  { id: "iva", title: "Precios con IVA: decidir y anotar", how: "Con el contador: ¿los US$119/219/449 incluyen el 19% de IVA? Hoy el Panel (Resumen y Costos fijos) asume que sí y lo resta. Si el precio va + IVA, hay que cambiar la web y el checkout: avísale a Claude.", urgent: true, who: "tu" },
  { id: "abogado", title: "Abogado: Términos, Privacidad y uso de caras y voces", how: "Que revise /terminos y /privacidad (Ley 19.628 y la nueva Ley 21.719 de datos personales), el consentimiento para clonar caras y voces, el retracto y el uso de anuncios de terceros en «Espiar anuncios».", urgent: true, who: "tu" },
  { id: "mal-uso", title: "Protocolo ante mal uso (suplantación, estafas)", how: "Definir qué hacer si alguien denuncia que usaron su cara o voz sin permiso: bloquear la cuenta, borrar el contenido, guardar registro y responder en 48 h. Escríbelo en una página y Claude lo agrega a los Términos y al Panel.", urgent: true, who: "tu" },
  { id: "staging", title: "Ambiente de pruebas listo", how: "1) Supabase → New project «creads-staging» y ejecuta ahí schema.sql, tenancy.sql y billing.sql. 2) Vercel → Settings → Environment Variables: copia cada variable marcando solo «Preview», con las claves del proyecto de pruebas (y claves de prueba de la pasarela, nunca las reales). 3) Avísale a Claude: publica la rama «staging» y te pasa el link (sale con una franja amarilla «AMBIENTE DE PRUEBAS»).", urgent: true, who: "tu" },
  { id: "alarma-prueba", title: "Probar las alarmas por correo", how: "Panel → Errores y alarmas → «Enviarme una alarma de prueba». Si no llega, revisa spam y que RESEND_API_KEY esté en Vercel.", urgent: true, who: "tu" },
  { id: "cuota-google", title: "Pedir más cuota de Veo a Google (justo antes de lanzar)", how: "Google Cloud → IAM y administración → Cuotas → busca «Veo» / «generate video» → solicitar aumento. Pide para al menos 30 videos por minuto. Tarda días: hazlo apenas tengas fecha de lanzamiento.", urgent: true, who: "tu" },
  { id: "beta", title: "Beta cerrada con 5 a 10 clientes reales", how: "Antes del lanzamiento abierto: que cada uno haga el recorrido completo (se registra → paga → voz y avatar → crea un anuncio → lo descarga). Mira dónde se traban, compara el gasto real de cada proveedor con el Panel y pregúntales cuánto pagarían.", urgent: true, who: "tu" },
  { id: "c-e2e", title: "Claude: pruebas automáticas del recorrido completo", how: "Un robot que todos los días en el ambiente de pruebas se registra, paga en modo prueba, genera un anuncio barato y lo descarga, y te avisa si algo se rompe. Necesita el ambiente de pruebas listo.", urgent: true, who: "claude" },
  { id: "c-gasto", title: "Claude: gasto real por proveedor en el Panel", how: "Conectar las facturas o consumos de Google, fal.ai, ElevenLabs y Anthropic para comparar lo estimado con lo cobrado. Se hace durante la beta.", urgent: true, who: "claude" },
  { id: "c-contracargos", title: "Claude: evidencia para contracargos", how: "Por cada pago, guardar qué generó el cliente, cuándo y desde dónde, para defenderte si desconoce el cargo con su banco.", urgent: true, who: "claude" },
  { id: "c-retencion", title: "Claude: borrado automático de archivos viejos", how: "Aplicar la política de retención de los Términos: borrar solo los archivos de cuentas cerradas o vencidas hace más del plazo, para no pagar almacenamiento de más.", who: "claude" },
  { id: "c-analitica", title: "Claude: analítica de producto (dónde abandonan)", how: "Medir cada paso (registro, pago, voz, avatar, primer anuncio) para ver dónde se cae la gente. Necesita que crees una cuenta gratis en posthog.com y pegues la clave en Vercel.", who: "claude" },
  { id: "c-cola", title: "Claude: fila de generación por proveedor", how: "Que los videos esperen su turno en una fila con un máximo por proveedor (Google, fal.ai, ElevenLabs) en vez de mandarse todos juntos. Así, con cientos de clientes generando a la vez, nadie recibe un error por «demasiadas solicitudes»: solo espera unos segundos más. Se prueba en el ambiente de pruebas.", urgent: true, who: "claude" },
  { id: "c-carga", title: "Claude: prueba de carga (cientos de clientes a la vez)", how: "Simular 500 a 1.000 clientes usando Creads al mismo tiempo en el ambiente de pruebas, sin generar videos reales (no gasta), para ver qué se pone lento y arreglarlo antes de lanzar.", urgent: true, who: "claude" },
  { id: "c-tablas", title: "Claude: registros en la base de datos", how: "Mover a tablas de la base de datos lo que hoy se guarda en archivos (errores, soporte, avisos, caché del espía). Con miles de clientes, los archivos se vuelven lentos y se pueden pisar.", who: "claude" },
  { id: "c-auditoria", title: "Revisión de un programador senior humano", how: "Cuando haya ingresos: unas horas de un experto en seguridad que revise el código y las claves, y alguien que pueda responder si algo se cae un domingo.", who: "tu" },
  { id: "pasarela", title: "Automático 1 · Cobro mensual automático (Flow o Stripe)", how: "Lo más importante para escalar: el cliente no tiene que acordarse de renovar. Con la SpA lista: revisa en stripe.com/global si aparece Chile. Recomendado partir con Flow (Webpay, cobro mensual automático): crea la cuenta, saca la API Key y la Secret Key, pégalas en Vercel y avísale a Claude para conectarla.", urgent: true },
  { id: "compra", title: "Compra de prueba", how: "Cuando la pasarela esté conectada: desde una cuenta nueva compra el pack de 500 créditos. Deben llegar los créditos y el correo de pago. Después la puedes devolver.", urgent: true },
  { id: "2fa", title: "Verificación en dos pasos en tus cuentas", how: "Primero las 5 llaves de todo: correo (Google), Vercel, GitHub, Supabase y Namecheap. También tu cuenta de Creads (Mi cuenta). Después: Mercado Pago, Google Cloud, fal.ai, ElevenLabs, Anthropic y Resend.", urgent: true },
  { id: "recarga", title: "Automático 2 · Recarga automática con tarjeta", how: "Para no quedarte nunca sin saldo. Google AI Studio → Billing → Setup auto-reload (US$50 cuando quede menos de US$15). ElevenLabs → Developers → Top Up → Auto Top Up (US$20 bajo US$10). fal.ai y Anthropic: buscar «Auto top-up» o «Auto reload» en Billing (US$50 bajo US$20 / US$20 bajo US$5)." },
  { id: "caps", title: "Topes de gasto", how: "Límite mensual en fal.ai, ElevenLabs y Anthropic; alerta de presupuesto en Google Cloud. El tope diario de Creads está en Saldos y alertas.", urgent: true },
  { id: "vercel-pro", title: "Vercel en plan Pro", how: "El plan gratis (Hobby) no permite uso comercial y corta los procesos largos (armar películas, clonar voces). Vercel → Settings → Billing → Pro (US$20/mes).", urgent: true },
  { id: "backups", title: "Supabase en plan Pro (no se pausa y tiene respaldo)", how: "El plan gratis se pausa solo si pasa días sin uso y no tiene respaldo. Supabase → Settings → Billing → Pro (US$25/mes): respaldo diario incluido.", urgent: true },
  { id: "dominio", title: "Dominio y correo con renovación automática", how: "Namecheap → Domain List → creadsia.com → Auto-Renew activado y tarjeta al día. Lo mismo con Google Workspace (tu correo hola@creadsia.com). Si el dominio vence, se cae todo." },
  { id: "monitor", title: "Aviso si la web se cae", how: "uptimerobot.com (gratis) → crear cuenta → Add New Monitor → HTTP(s) → URL https://www.creadsia.com → cada 5 minutos → avisarte por correo y por la app del celular.", urgent: true },
  { id: "whatsapp", title: "WhatsApp de ayuda", how: "Vercel → Environment Variables → NEXT_PUBLIC_WHATSAPP = tu número con código de país, sin + ni espacios (ej: 56912345678) → Redeploy. Aparece un botón de WhatsApp en la web, en el checkout y en el menú de cuenta." },
  { id: "claves", title: "Gestor de contraseñas y acceso de emergencia", how: "Guarda todas las claves (Vercel, Supabase, Namecheap, proveedores, ADMIN_ACCESS_CODE) en 1Password o Bitwarden y deja a una persona de confianza con acceso de emergencia.", urgent: true },
  { id: "marca", title: "Registrar la marca Creads IA", how: "inapi.cl → solicitud de marca (clase 42: software y servicios en línea; opcional clase 35: publicidad). Cuesta unos $100.000–200.000 CLP. Que nadie te la pueda quitar." },
  { id: "contador", title: "Contador: IVA, términos y giro", how: "Confirmar IVA incluido y boletas, giro de la SpA (620100 / 631100), pagos a proveedores extranjeros en US$, y revisar /terminos: sobre todo la cláusula de derecho a retracto (no aplica porque los créditos se entregan al instante; devolución si no usó créditos dentro de 10 días).", urgent: true },
  { id: "gasto-real", title: "Automático 3 · Gasto real de cada proveedor en el Panel", how: "Después de la pasarela: clave de administrador de Anthropic (gasto diario real) y la exportación de facturación de Google Cloud, para comparar lo estimado con lo que cobran de verdad. Pídeselo a Claude.", urgent: true },
  { id: "boletas", title: "Automático 4 · Boletas automáticas", how: "Que cada cobro emita su boleta electrónica sola. Definir con el contador (inicio de actividades en el SII) y activarlo en la pasarela (Flow puede emitirlas) o con un servicio de boletas; después Claude lo conecta.", urgent: true },
  { id: "dia-1", title: "Día 1: borrón y cuenta nueva", how: "Justo antes de la primera venta real: lo de hoy se archiva como «Ensayo» (no se borra) y el Panel parte de cero en movimientos, pedidos y gasto en IA. Claude te muestra antes la lista exacta para tu OK.", urgent: true },
  { id: "precios", title: "Precios nuevos (oct 2026)", how: "Starter US$119, Plus US$219, Studio US$449 al mes, con 50% el primer mes; anual con 2 meses gratis; recargas US$25 / 89 / 209 (sin cambio). Con el 50% cada plan deja al menos unos US$24 el primer mes aunque el cliente use todos los créditos. Márcalo cuando lo revises en la web." },
  { id: "espia", title: "Buscador de anuncios (Espiar anuncios)", how: "En scrapecreators.com → copia tu API key y pégala en Vercel como SCRAPECREATORS_API_KEY (Production) y redeploy. Reclama los créditos gratis (¿cómo nos conociste? +1.000, estrella en GitHub +1.000). Después recarga: US$47 = 25.000 créditos (cada búsqueda o guion ≈ 1 crédito, las búsquedas repetidas en 24 h no gastan). Activa la recarga automática si la ofrecen." },
  { id: "inspiracion", title: "Llenar la galería «Recrear video»", how: "Entra a Recrear video (menú Herramientas) y, abajo, «Agregar ejemplo»: sube 8 a 12 anuncios ganadores de tus nichos (hasta 30 s, que tengas permiso para usar), con título, etiqueta (ej. «Seguros · UGC») y una instrucción sugerida. Tus clientes los verán con el botón «Recrear». Antes de lanzar, prueba 1 recreación de cada tipo (gasta créditos reales: unos US$0,85 cambiar elementos de 5 s, US$1,30 copiar movimiento de 10 s)." },
];

/**
 * Order of the red (blocking) work: first what the owner can do alone from his computer (settings and
 * connections), hardest first, with a rough time; then what needs another person or has to wait;
 * then Claude's part. Ids not listed here go last in their group.
 */
const RED_ORDER: { pc: [string, string][]; otros: [string, string][]; claude: [string, string][] } = {
  pc: [
    ["pasarela", "2–3 h + días de aprobación: por eso va primero"],
    ["staging", "1–2 h"],
    ["mp-token", "20 min"],
    ["mp-webhook", "20 min"],
    ["gasto-real", "45 min (después de la pasarela)"],
    ["billing", "10 min"],
    ["meta", "15 min"],
    ["2fa", "1 h (son varias cuentas)"],
    ["claves", "1 h"],
    ["caps", "30 min"],
    ["mal-uso", "30 min (escribir una página)"],
    ["compra", "15 min (cuando la pasarela esté lista)"],
    ["admin", "5 min"],
    ["email", "10 min"],
    ["ai", "15 min"],
    ["cron", "5 min"],
    ["mp-once", "5 min"],
    ["dolar", "5 min"],
    ["vercel-pro", "5 min (pagar)"],
    ["backups", "5 min (pagar)"],
    ["monitor", "10 min"],
    ["alarma-prueba", "2 min (después de los correos)"],
  ],
  otros: [
    ["contador", "una reunión: lleva también IVA y boletas"],
    ["iva", "se decide en la misma reunión con el contador"],
    ["boletas", "con el contador"],
    ["abogado", "pide hora ya: suele tardar"],
    ["cuota-google", "pedirla 1–2 semanas antes de lanzar"],
    ["beta", "al final, con todo lo de arriba listo"],
    ["dia-1", "lo último, justo antes de la primera venta"],
  ],
  claude: [
    ["c-e2e", "parte cuando el ambiente de pruebas esté listo"],
    ["c-contracargos", "parte cuando la pasarela esté lista"],
    ["c-cola", "parte cuando el ambiente de pruebas esté listo"],
    ["c-carga", "después de la fila, antes de la beta"],
    ["c-gasto", "durante la beta"],
  ],
};

function Lanzamiento() {
  const [checks, setChecks] = useState<LaunchCheck[] | null>(null);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Record<string, boolean>>({});
  const load = () => {
    setErr("");
    fetch("/api/admin/lanzamiento").then((r) => r.json()).then((d) => (d.checks ? setChecks(d.checks) : setErr(d.error || "No se pudo revisar."))).catch(() => setErr("No se pudo revisar. Revisa tu conexión."));
  };
  useEffect(() => {
    load();
    try { setDone(JSON.parse(localStorage.getItem("launch-done") || "{}")); } catch {}
  }, []);
  const tick = (id: string) => setDone((d) => {
    const n = { ...d, [id]: !d[id] };
    try { localStorage.setItem("launch-done", JSON.stringify(n)); } catch {}
    return n;
  });
  const okCount = (checks?.filter((c) => c.state === "ok").length ?? 0) + MANUAL.filter((m) => done[m.id]).length;
  const total = (checks?.length ?? Object.keys(AUTO).length) + MANUAL.length;
  const label: Record<LaunchCheck["state"], [string, string]> = { ok: ["good", "Listo"], falta: ["bad", "Falta"], revisar: ["warn", "Revisar"] };
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Lista de lanzamiento</h2>
          <p className="text-sm text-muted">Arriba, en rojo y en orden, lo que bloquea. Ve de a uno empezando por el número 1. Los que dicen «se marca solo» se ponen verdes al tocar «Revisar de nuevo» (después de cambiar algo en Vercel, haz Redeploy primero); los demás los marcas tú.</p>
        </div>
        <div className="flex items-center gap-2">
          <Pill t={okCount === total ? "good" : "acc"}>{okCount} de {total} listos</Pill>
          <button type="button" onClick={load} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold hover:bg-surface-2">Revisar de nuevo</button>
        </div>
      </div>
      {(() => {
        if (!checks) return null; // wait for the automatic checks so the banner doesn't flash red
        const blocking = MANUAL.filter((m) => m.urgent && !done[m.id]).length + (checks?.filter((c) => c.state === "falta").length ?? 0);
        return blocking > 0 ? (
          <div className="rounded-xl border border-bad/50 bg-bad/10 px-4 py-3">
            <b className="text-bad">🔴 Todavía no se puede lanzar: faltan {blocking} {blocking === 1 ? "cosa que bloquea" : "cosas que bloquean"}.</b>
            <p className="text-sm text-muted">Están abajo en rojo, ordenadas. Cuando no quede ninguna, este aviso se pone verde.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-good/50 bg-good/10 px-4 py-3"><b className="text-good">🟢 Lista para lanzar: no queda nada que bloquee.</b></div>
        );
      })()}
      {err && <p className="text-sm text-bad">{err}</p>}
      {!checks ? <p className="text-muted">Revisando…</p> : (() => {
        type Row = { id: string; title: string; how: string; auto?: LaunchCheck; time?: string; who?: "tu" | "claude" };
        const autoRow = (c: LaunchCheck): Row => ({ id: c.id, title: AUTO[c.id]?.title ?? c.id, how: AUTO[c.id]?.how ?? "", auto: c });
        const red: Row[] = [
          ...checks.filter((c) => c.state === "falta").map(autoRow),
          ...MANUAL.filter((m) => m.urgent && !done[m.id]),
        ];
        const pick = (list: [string, string][]): Row[] => list.flatMap(([id, time]) => { const r = red.find((x) => x.id === id); return r ? [{ ...r, time }] : []; });
        const pc = pick(RED_ORDER.pc), otros = pick(RED_ORDER.otros), cl = pick(RED_ORDER.claude);
        const placed = new Set([...pc, ...otros, ...cl].map((r) => r.id));
        for (const r of red) if (!placed.has(r.id)) (r.who === "claude" ? cl : r.auto || r.who === "tu" ? pc : otros).push(r);

        const redItem = (r: Row, n?: number, first?: boolean) => (
          <li key={r.id}>
            <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${first ? "border-bad bg-bad/20 ring-2 ring-bad/40" : "border-bad/50 bg-bad/10"}`}>
              {r.auto
                ? <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-bad px-1.5 text-xs font-bold text-white" title="Se pone verde solo cuando esté hecho">{n ?? "!"}</span>
                : <span className="flex items-center gap-2">
                    {n !== undefined && <span className="mt-0.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-bad px-1.5 text-xs font-bold text-white">{n}</span>}
                    <input type="checkbox" checked={Boolean(done[r.id])} onChange={() => tick(r.id)} aria-label={`Marcar «${r.title}» como hecho`} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                  </span>}
              <span className="flex flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-sm text-bad">{r.title}</b>
                  {first && <span className="rounded-full bg-bad px-2 py-0.5 text-[10px] font-bold text-white">EMPIEZA AQUÍ</span>}
                  {r.time && <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-muted">{r.time}</span>}
                  {r.auto && <span className="text-[11px] text-muted">se marca solo cuando esté hecho</span>}
                </span>
                {r.auto?.detail && <span className="text-sm">{r.auto.detail}</span>}
                <span className="text-xs text-muted">{r.how}</span>
              </span>
            </div>
          </li>
        );
        const restItem = (m: (typeof MANUAL)[number]) => (
          <li key={m.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface-2 px-4 py-3">
              <input type="checkbox" checked={Boolean(done[m.id])} onChange={() => tick(m.id)} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
              <span className="flex flex-col gap-0.5">
                <b className={`text-sm ${done[m.id] ? "text-muted line-through" : ""}`}>{m.title}{m.who === "claude" ? " (Claude)" : ""}</b>
                <span className="text-xs text-muted">{m.how}</span>
              </span>
            </label>
          </li>
        );
        const rest = MANUAL.filter((m) => !(m.urgent && !done[m.id]));
        const restOrder = (l: typeof MANUAL) => [...l.filter((m) => !done[m.id]), ...l.filter((m) => done[m.id])];
        return (
          <>
            {red.length > 0 && (
              <div className="flex flex-col gap-4 rounded-2xl border border-bad/40 p-3 sm:p-4">
                <h3 className="font-display text-lg font-bold text-bad">🔴 Lo que bloquea el lanzamiento, en orden</h3>
                {pc.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-bold">1. Desde tu computador, sin depender de nadie <span className="font-normal text-muted">(de lo más difícil a lo más fácil)</span></h4>
                    <ul className="flex flex-col gap-2">{pc.map((r, i) => redItem(r, i + 1, i === 0))}</ul>
                  </div>
                )}
                {otros.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-bold">2. Necesitas a otra persona o hay que esperar <span className="font-normal text-muted">(pide las horas ya, mientras avanzas con lo de arriba)</span></h4>
                    <ul className="flex flex-col gap-2">{otros.map((r) => redItem(r))}</ul>
                  </div>
                )}
                {cl.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <h4 className="text-sm font-bold">3. Pendiente de Claude <span className="font-normal text-muted">(márcalo cuando te lo entregue)</span></h4>
                    <ul className="flex flex-col gap-2">{cl.map((r) => redItem(r))}</ul>
                  </div>
                )}
              </div>
            )}
            <h3 className="mt-2 text-sm font-bold text-muted">Todo lo demás (no bloquea)</h3>
            <ul className="flex flex-col gap-2">
              {checks.filter((c) => c.state !== "falta").map((c) => (
                <li key={c.id} className="flex flex-col gap-1 rounded-xl bg-surface-2 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <b className="text-sm">{AUTO[c.id]?.title ?? c.id}</b>
                    <Pill t={label[c.state][0]}>{label[c.state][1]}</Pill>
                  </div>
                  <p className="text-sm">{c.detail}</p>
                  {c.state !== "ok" && AUTO[c.id] && <p className="text-xs text-muted">Cómo: {AUTO[c.id].how}</p>}
                </li>
              ))}
              {restOrder(rest).map(restItem)}
            </ul>
          </>
        );
      })()}
    </section>
  );
}

// ---------- Saldos y alertas ----------
type Svc = "fal" | "google" | "eleven" | "claude";
interface SvcStatus {
  id: Svc; name: string; what: string; recharge: string;
  level: "ok" | "bajo" | "agotado" | "desconocido";
  headline: string; detail: string; usd: number | null; estimated: boolean;
  spentMonth: number; topUps: number; lastFailure: { at: string; msg: string } | null;
}
interface SaldosData { services: SvcStatus[]; umbrales: { fal: number; google: number; eleven: number; diario: number }; today: number; alerts: { service: Svc; text: string }[] }

const LEVEL: Record<SvcStatus["level"], [string, string]> = {
  ok: ["good", "Bien"],
  bajo: ["warn", "Saldo bajo"],
  agotado: ["bad", "Sin saldo"],
  desconocido: ["", "Sin lectura"],
};

function Saldos() {
  const [d, setD] = useState<SaldosData | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [u, setU] = useState<SaldosData["umbrales"] | null>(null);
  const [saved, setSaved] = useState("");

  const load = useCallback(async (init?: RequestInit) => {
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/admin/saldos", init);
      const x = await r.json();
      if (!r.ok) throw new Error(x.error);
      setD(x); setU(x.umbrales);
      return true;
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo revisar."); return false; } finally { setBusy(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const put = (body: unknown) => load({ method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Saldos y alertas</h2>
          <p className="text-sm text-muted">Cuánta plata queda en cada servicio que usa Creads. Si un servicio se queda sin saldo, sus modelos dejan de funcionar: Creads revisa antes de gastar y avisa en vez de fallar a medias.</p>
        </div>
        <button type="button" onClick={() => load()} disabled={busy} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-muted hover:text-ink disabled:opacity-50">{busy ? "Revisando…" : "Revisar ahora"}</button>
      </div>

      {err && <p className="rounded-lg border border-bad/40 bg-bad/10 p-3 text-sm">{err}</p>}
      {!d && !err && <p className="text-muted">Revisando saldos…</p>}

      {d && (d.alerts.length ? (
        <ul className="flex flex-col gap-2" aria-label="Alertas">
          {d.alerts.map((a) => (
            <li key={a.service + a.text} className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-sm font-semibold">{a.text}</li>
          ))}
        </ul>
      ) : <p className="rounded-lg bg-good/10 px-3 py-2 text-sm font-semibold text-good">Todo con saldo. No hay alertas.</p>)}

      {d && (
        <div className="grid gap-3 md:grid-cols-2">
          {d.services.map((s) => {
            const [t, label] = LEVEL[s.level];
            return (
              <section key={s.id} className={card} aria-labelledby={`sv-${s.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 id={`sv-${s.id}`} className="font-display text-lg font-bold">{s.name}</h3>
                    <p className="text-xs text-muted">{s.what}</p>
                  </div>
                  <Pill t={t}>{label}</Pill>
                </div>
                <p className={`${num} text-2xl font-bold`}>{s.headline}</p>
                <p className="text-sm text-muted">{s.detail}</p>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-xs text-muted">Gastado este mes (Creads)</dt><dd className={num}>{fmtUsd(s.spentMonth, 2)}</dd></div>
                  <div className="rounded-lg bg-surface-2 px-3 py-2"><dt className="text-xs text-muted">Recargas anotadas</dt><dd className={num}>{s.topUps ? fmtUsd(s.topUps, 2) : "—"}</dd></div>
                </dl>
                {s.lastFailure && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm">
                    <span>Último rechazo por saldo: {new Date(s.lastFailure.at).toLocaleString("es-CL")}</span>
                    <button type="button" onClick={() => put({ listo: s.id })} className="text-xs font-semibold text-muted hover:text-ink">Ya cargué, ocultar</button>
                  </div>
                )}
                <a href={s.recharge} target="_blank" rel="noreferrer" className={`${btn} w-fit`}>Cargar saldo en {s.name}</a>
              </section>
            );
          })}
        </div>
      )}

      {u && (
        <section className={card}>
          <div>
            <h3 className="font-display text-lg font-bold">Cuándo avisarte</h3>
            <p className="text-sm text-muted">Te aviso aquí y arriba en el estudio cuando un servicio baje de estos montos. El tope diario frena todas las generaciones del día (de todos los clientes) si se pasa: protege tus cuentas si algo sale mal. 0 = sin tope.</p>
          </div>
          <form className="flex flex-wrap items-end gap-3" onSubmit={async (e) => { e.preventDefault(); setSaved(""); if (await put({ umbrales: u })) setSaved("Guardado."); }}>
            <Field label="fal.ai: menos de (US$)"><Num id="u-fal" value={u.fal} onChange={(v) => setU({ ...u, fal: v })} /></Field>
            <Field label="Google: menos de (US$)"><Num id="u-google" value={u.google} onChange={(v) => setU({ ...u, google: v })} /></Field>
            <Field label="ElevenLabs: menos del (% del plan)"><Num id="u-eleven" value={u.eleven} max={100} onChange={(v) => setU({ ...u, eleven: v })} /></Field>
            <Field label={`Tope diario de todo Creads (US$, hoy van ${d ? fmtUsd(d.today, 2) : "…"})`}><Num id="u-diario" value={u.diario} step={10} onChange={(v) => setU({ ...u, diario: v })} /></Field>
            <button type="submit" disabled={busy} className={btn}>Guardar</button>
            {saved && <span className="text-sm text-good" role="status">{saved}</span>}
          </form>
        </section>
      )}
    </div>
  );
}
