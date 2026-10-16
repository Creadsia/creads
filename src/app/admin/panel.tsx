"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Config,
  type CostoFijo,
  type Finanzas,
  type Movimiento,
  type PlanMonth,
  fijoMensual,
  planMonth,
  proyectar,
  toUsd,
} from "@/lib/finance";

// The owner's control room: money, models, accounts, sign-ups and service status in one place.

type Tab = "resumen" | "clientes" | "planes" | "movs" | "fijos" | "modelos" | "cuentas" | "registros" | "estado";
const TABS: [Tab, string][] = [
  ["resumen", "Resumen"],
  ["clientes", "Clientes"],
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
    <input id={id} type="number" value={value} step={step} min={min} max={max} className={`${input} w-28 ${num}`}
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
  const [tab, setTab] = useState<Tab>("resumen");
  const [data, setData] = useState<Finanzas | null>(null);
  const [status, setStatus] = useState("Cargando…");
  const saveT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try { const t = localStorage.getItem("admin-tab") as Tab | null; if (t && TABS.some(([k]) => k === t)) setTab(t); } catch {}
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
            <Field label="Dólar (CLP)"><Num id="usdclp" value={data.config.usdClp} step={5} onChange={(v) => setCfg((c) => { c.usdClp = v || 950; })} /></Field>
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

      {!data ? (
        tab === "registros" ? <Registros /> : tab === "estado" ? <Estado /> : tab === "clientes" ? <Clientes /> : <div className={card}><p className="text-muted">{status}</p></div>
      ) : (
        <>
          {tab === "resumen" && <Resumen d={data} setCfg={setCfg} />}
          {tab === "planes" && <Planes d={data} setCfg={setCfg} />}
          {tab === "movs" && <Movimientos d={data} change={change} />}
          {tab === "fijos" && <Fijos d={data} change={change} />}
          {tab === "modelos" && <Modelos d={data} change={change} />}
          {tab === "cuentas" && <Cuentas d={data} />}
          {tab === "clientes" && <Clientes />}
          {tab === "registros" && <Registros />}
          {tab === "estado" && <Estado />}
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
  const p = proyectar(d);
  const rows: [string, number][] = [["Ingresos (MRR)", p.mrr], ["Modelos de IA", -p.modelos], ["Stripe", -p.stripe], ["Afiliados", -p.afiliados], ["Costos fijos", -p.fijos]];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
        <Stat label="Costos fijos al mes" value={fmtUsd(f)} sub={fmtClp(f * c.usdClp)} />
        <Stat label="Invertido hasta hoy" value={fmtUsd(gastado)} sub={`${fmtClp(gastado * c.usdClp)} en pagos y recargas`} />
        <Stat label="Ingresos registrados" value={fmtUsd(ingresos)} sub={ingresos ? fmtClp(ingresos * c.usdClp) : "Todavía sin clientes pagando"} />
        <Stat label="Para cubrir los fijos" value={`${eq} suscriptores`} sub="promedio de los 3 planes" />
        {faltan > 0 && <Stat label="Por completar" value={String(faltan)} sub="montos sin anotar" t="warn" />}
      </div>

      <section className={card}>
        <div>
          <h2 className="font-display text-xl font-bold">Proyección mensual</h2>
          <p className="text-sm text-muted">Cambia cuántos suscriptores tienes y mira cuánto queda de verdad, después de modelos, Stripe, afiliados y costos fijos.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {c.planes.map((pl) => (
            <Field key={pl.id} label={pl.nombre}><Num id={`p-${pl.id}`} value={c.proyeccion[pl.id] ?? 0} onChange={(v) => setCfg((x) => { x.proyeccion[pl.id] = v; })} /></Field>
          ))}
          <Field label="% de créditos que usan"><Num id="p-uso" value={c.uso} step={5} max={100} onChange={(v) => setCfg((x) => { x.uso = v; })} /></Field>
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
                  <td className="px-3 py-2">Utilidad neta al mes</td>
                  <td className={`px-3 py-2 text-right ${num} ${p.neto >= 0 ? "text-good" : "text-bad"}`}>{fmtUsd(p.neto)}</td>
                  <td className={`px-3 py-2 text-right ${num} ${p.neto >= 0 ? "text-good" : "text-bad"}`}>{fmtClp(p.neto * c.usdClp)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="flex flex-col gap-3">
            <Stat label="Margen neto real" value={fmtPct(p.margen)} sub={`${p.subs} suscriptores · ${fmtUsd(p.neto * 12)} al año`} t={tone(p.margen)} />
            <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
              Supone que usan el {c.uso}% de sus créditos y que el {c.proyeccion.pctAfiliado}% llegó por un afiliado con comisión{" "}
              {c.afiliado.tipo === "recurrente" ? `de ${c.afiliado.pct}% mensual` : "única (no entra en el mes a mes)"}.
            </p>
          </div>
        </div>
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
            <thead><tr>{["Plan", "Precio/mes", "Modelos de IA", "Stripe", "Afiliado", "Te queda", "Margen", "Reparto"].map((h, i) => <th key={h} className={`${th} ${i && i < 7 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
            <tbody>
              {c.planes.map((p) => {
                const r = planMonth(c, p, o);
                return (
                  <tr key={p.id}>
                    <td className={td}><strong>{p.nombre}</strong><br /><span className="text-xs text-muted">{p.creditos.toLocaleString("es-CL")} créditos</span></td>
                    <td className={`${td} ${num} text-right`}>{fmtUsd(r.precio, 2)}</td>
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
function Fijos({ d, change }: { d: Finanzas; change: Change }) {
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
interface Cliente {
  id: string; name: string; kind: string; plan: string | null; active: boolean; created_at: string; usdMonth: number;
  people: { email: string; name: string | null; role: string; last_login: string | null }[];
}
function Clientes() {
  const [rows, setRows] = useState<Cliente[] | null>(null);
  const [err, setErr] = useState("");
  const [missing, setMissing] = useState(false);
  const [f, setF] = useState({ name: "", email: "", contact: "", plan: "" });
  const [busy, setBusy] = useState(false);
  const [made, setMade] = useState<{ email: string; password: string; workspace: string } | null>(null);
  const load = useCallback(() => {
    fetch("/api/admin/clientes").then(async (r) => {
      const d = await r.json();
      if (!r.ok) { setMissing(Boolean(d.missing)); throw new Error(d.error); }
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
      setMade({ email: f.email, password: d.password, workspace: d.workspace });
      setF({ name: "", email: "", contact: "", plan: "" });
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo crear."); } finally { setBusy(false); }
  }
  async function toggle(c: Cliente) {
    const r = await fetch("/api/admin/clientes", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: c.id, active: !c.active }) });
    if (r.ok) load();
  }
  const total = (rows ?? []).reduce((a, c) => a + c.usdMonth, 0);
  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div>
          <h2 className="font-display text-xl font-bold">Clientes</h2>
          <p className="text-sm text-muted">Cada cliente tiene su propio espacio: solo ve sus avatares, productos, guiones y videos. Aquí ves quién usa Creads y cuánto gastó en modelos este mes.</p>
        </div>
        {missing && <p className="rounded-lg bg-warn/12 p-3 text-sm">Falta activar las cuentas separadas en Supabase (el archivo tenancy.sql). Te dejé los pasos en el chat.</p>}
        {err && !missing && <p className="text-sm text-bad">{err}</p>}
        {!rows && !err && <p className="text-muted">Cargando…</p>}
        {rows && (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
              <Stat label="Clientes" value={String(rows.filter((c) => c.kind === "client").length)} />
              <Stat label="Activos" value={String(rows.filter((c) => c.kind === "client" && c.active).length)} />
              <Stat label="Gasto en modelos (mes)" value={fmtUsd(total, 2)} />
            </div>
            <div className="min-w-0 overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr>{["Cliente", "Personas", "Plan", "Gasto del mes", "Estado", ""].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id}>
                      <td className={td}><b>{c.name}</b><span className="block font-mono text-xs text-muted">{c.id}</span></td>
                      <td className={td}>{c.people.length ? c.people.map((p) => <span key={p.email} className="block">{p.email} <span className="text-xs text-muted">({p.role === "owner" ? "dueño" : p.role === "admin" ? "admin" : "miembro"})</span></span>) : <span className="text-muted">—</span>}</td>
                      <td className={td}>{c.plan || <span className="text-muted">—</span>}</td>
                      <td className={`${td} ${num}`}>{fmtUsd(c.usdMonth, 2)}</td>
                      <td className={td}><Pill t={c.active ? "good" : "warn"}>{c.kind === "owner" ? "Creadsia" : c.active ? "Activo" : "Pausado"}</Pill></td>
                      <td className={td}>{c.kind === "client" && <button type="button" onClick={() => toggle(c)} className="text-xs text-muted hover:text-ink">{c.active ? "Pausar" : "Reactivar"}</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <section className={card}>
        <h3 className="font-display text-lg font-bold">Crear cliente</h3>
        <p className="text-sm text-muted">Crea su espacio y su primera cuenta (administrador de su espacio). La clave temporal aparece una sola vez: mándasela y que la cambie en «Mi cuenta».</p>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre del cliente o empresa"><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} /></Field>
          <Field label="Correo de acceso"><input required type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} /></Field>
          <Field label="Nombre de la persona (opcional)"><input value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} className={input} /></Field>
          <Field label="Plan (opcional)"><input value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} placeholder="fundador, pro…" className={input} /></Field>
          <div className="sm:col-span-2"><button type="submit" disabled={busy} className={btn}>{busy ? "Creando…" : "Crear cliente"}</button></div>
        </form>
        {made && (
          <div className="rounded-lg bg-good/12 p-3 text-sm" role="status">
            Listo: <b>{made.email}</b> entra en creadsia.com/app con la clave temporal <b className="font-mono select-all">{made.password}</b> (espacio <span className="font-mono">{made.workspace}</span>).
          </div>
        )}
      </section>
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
