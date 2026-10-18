"use client";

import { useCallback, useEffect, useState } from "react";
import type { Leak, PlanRow, Segment, Tip } from "@/lib/rentabilidad";

// Panel → Rentabilidad: real cost per finished ad, failures per provider, margin per plan at full use,
// the biggest money leaks and cheaper models per step. All in US$, from the last N days.

interface Data {
  days: number; updated: string;
  costoCredito: { usado: number; real: { usd: number; credits: number; base: number } | null; supuesto: number };
  clientes: Segment; interno: Segment; planes: PlanRow[]; fugas: Leak[]; otrasFugas: Leak[]; baratos: Tip[];
}

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const usd = (n: number, d = 2) => `${n < 0 ? "−" : ""}US$${Math.abs(n).toLocaleString("es-CL", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const th = "px-2 py-2 text-left text-xs font-semibold text-muted";
const td = "px-2 py-2 font-mono text-sm tabular-nums";

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="py-4 text-sm text-muted">{empty}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse">
        <thead><tr className="border-b border-line">{head.map((h, i) => <th key={h} className={`${th} ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={!j ? "px-2 py-2 text-sm" : typeof c === "string" && !/^[−\d]|^US\$/.test(c) ? "px-2 py-2 text-right text-sm" : `${td} text-right`}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

export default function Rentabilidad() {
  const [days, setDays] = useState(30);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [who, setWho] = useState<"clientes" | "interno">("clientes");

  const load = useCallback(() => {
    setErr("");
    fetch(`/api/admin/rentabilidad?days=${days}`).then((r) => r.json().then((x) => ({ ok: r.ok, x })))
      .then(({ ok, x }) => { if (!ok) throw new Error(x.error); setD(x); })
      .catch((e) => setErr(e instanceof Error && e.message ? e.message : "No se pudo cargar."));
  }, [days]);
  useEffect(() => { load(); }, [load]);

  if (!d) return <div className={card}>{err ? <p role="alert" className="text-bad">{err}</p> : <p className="text-muted">Calculando…</p>}</div>;
  const s = d[who];
  const noClients = d.clientes.usd === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="rent-days" className="sr-only">Período</label>
          <select id="rent-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm font-semibold">
            {[7, 30, 90].map((n) => <option key={n} value={n}>Últimos {n} días</option>)}
          </select>
          <span className="rounded-lg bg-surface-2 px-3 py-2 text-sm text-muted">
            Costo real por crédito: <b className="font-mono text-ink">{usd(d.costoCredito.usado, 4)}</b> {d.costoCredito.real ? `(de ${d.costoCredito.real.credits.toLocaleString("es-CL")} créditos cobrados)` : `(supuesto del Panel: aún hay pocos datos de clientes)`}
          </span>
        </div>
        <button type="button" onClick={load} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold">Actualizar</button>
      </div>
      {err && <p role="alert" className="text-sm text-bad">{err}</p>}

      <section className={card} aria-labelledby="h-fugas">
        <h3 id="h-fugas" className="text-lg font-bold">Dónde más plata se pierde</h3>
        {d.fugas.length ? (
          <ol className="flex flex-col gap-2">
            {d.fugas.map((f, i) => (
              <li key={f.titulo} className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-surface-2 px-4 py-3">
                <span className="flex min-w-0 gap-3"><b className="text-accent-text">{i + 1}</b><span className="flex flex-col"><b className="text-sm">{f.titulo}</b><span className="text-xs text-muted">{f.detalle}</span></span></span>
                <span className="text-right"><b className="font-mono text-lg">{usd(f.usdMes)}</b><span className="block text-xs text-muted">al mes</span></span>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-muted">No se ve plata perdida en este período.</p>}
        {!!d.otrasFugas.length && <p className="text-xs text-muted">Después vienen: {d.otrasFugas.map((f) => `${f.titulo} (${usd(f.usdMes)}/mes)`).join(" · ")}.</p>}
      </section>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="De quién son los datos">
        {([["clientes", "Clientes"], ["interno", "Tus pruebas (tu cuenta)"]] as const).map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={who === k} onClick={() => setWho(k)} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${who === k ? "bg-ink text-bg" : "border border-line text-muted"}`}>{l}</button>
        ))}
        <span className="text-xs text-muted">
          {who === "clientes" ? `Total gastado en proveedores: ${usd(d.clientes.usd)}. Cuenta cada intento, falla y rehecho.` : `Total: ${usd(d.interno.usd)}. Tu cuenta no paga créditos, así que solo se ve el último intento de cada corte (es un mínimo).`}
        </span>
      </div>
      {who === "clientes" && noClients && <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm">Todavía no hay gasto de clientes en este período (Creads no está lanzado). Mira «Tus pruebas» para tener una idea, y vuelve después de la beta para los números reales.</p>}

      <section className={card} aria-labelledby="h-formato">
        <h3 id="h-formato" className="text-lg font-bold">Costo por anuncio terminado, por formato</h3>
        <Table empty="Sin anuncios en este período." head={["Formato", "Terminados", "Empezados", "Gasto total", "Costo por terminado", "Cortes por anuncio", "Intentos por corte"]}
          rows={s.formatos.map((f) => [f.formato, f.terminados, f.empezados, usd(f.usd), <b key="c">{f.terminados ? usd(f.usdPorTerminado) : "—"}</b>, f.cortesPorAnuncio || "—", f.intentosPorCorte || "—"])} />
        <p className="text-xs text-muted">«Costo por terminado» reparte también lo que se gastó en anuncios que fallaron o se abandonaron. No incluye la IA de texto (guiones, cortes, revisión), que todavía no se registra por anuncio.</p>
      </section>

      <section className={card} aria-labelledby="h-prov">
        <h3 id="h-prov" className="text-lg font-bold">Costo y fallas por proveedor</h3>
        <Table empty="Sin generaciones en este período." head={["Modelo", "Intentos", "Fallas", "Tasa de falla", "Gasto", "Gasto en fallas"]}
          rows={s.proveedores.map((p) => [p.familia, p.intentos, p.fallas, <span key="t" className={p.tasa >= 0.15 ? "text-bad" : p.tasa >= 0.05 ? "text-warn" : ""}>{pct(p.tasa)}</span>, usd(p.usd), usd(p.usdFallas)])} />
        <p className="text-xs text-muted">«Gasto en fallas» es lo máximo perdido: algunos proveedores no cobran lo que rechazan. Compáralo con sus facturas.</p>
      </section>

      <section className={card} aria-labelledby="h-planes">
        <h3 id="h-planes" className="text-lg font-bold">Margen por plan si el cliente usa todos sus créditos</h3>
        <Table empty="Sin planes." head={["Plan", "Cómo paga", "Precio", "Costo IA", "IVA", "Comisión", "Te queda", "Margen"]}
          rows={d.planes.map((p) => [<b key="p">{p.plan}</b>, p.caso, usd(p.precio), usd(p.costoIA), usd(p.iva), usd(p.comision), <b key="q" className={p.queda < 0 ? "text-bad" : "text-good"}>{usd(p.queda)}</b>, <span key="m" className={p.margen < 0 ? "text-bad" : ""}>{p.margen}%</span>])} />
        <p className="text-xs text-muted">Usa el costo real por crédito de arriba. IVA y comisión según «Costos fijos» del Panel; con Stripe la comisión puede cambiar. Es el peor caso: la mayoría de los clientes no usa el 100%.</p>
      </section>

      <section className={card} aria-labelledby="h-baratos">
        <h3 id="h-baratos" className="text-lg font-bold">Pasos que podrían usar un modelo más barato</h3>
        <Table empty="Sin sugerencias." head={["Paso", "Hoy", "Alternativa", "Más barato", "Ahorro estimado al mes"]}
          rows={d.baratos.map((t) => [<span key="p" className="flex flex-col"><b>{t.paso}</b><span className="text-xs text-muted">{t.calidad}</span></span>, t.hoy, t.alternativa, `${t.ahorroPct}%`, t.ahorroMes ? usd(t.ahorroMes) : "—"])} />
        <p className="text-xs text-muted">El ahorro al mes se calcula con lo gastado en el período. Antes de cambiar un paso, conviene probar 10 cortes con el modelo nuevo y comparar (esa prueba gasta unos pocos dólares: pídela con tu OK).</p>
      </section>
    </div>
  );
}
