"use client";

import { useEffect, useState } from "react";

// «¿Vamos rentables?» (owner, 24 Oct 2026): what each registration really costs (Meta + the gift ad), how many
// paid, and how many more paying customers are needed to break even. Works without Meta's API: the cost per
// registration is typed here (Meta's «costo por registro»), defaulting to $1.276.

const IVA = 1.19, MP = 0.0415, USD_CREDIT = 0.0193;
// first-month margin per plan if the customer uses ALL its credits (worst case), in US$
const PLANES = [
  { id: "basico", name: "Básico", usd: 25, credits: 500 },
  { id: "emprende", name: "Emprende", usd: 55, credits: 1500 },
  { id: "negocio", name: "Negocio", usd: 99, credits: 3000 },
].map((p) => {
  const net = (p.usd / IVA) * (1 - MP);
  return { ...p, peor: net - p.credits * USD_CREDIT, normal: net - (p.credits * USD_CREDIT) / 2 };
});

const clp = (n: number) => `$${Math.round(n).toLocaleString("es-CL")}`;
const KEY = "creads-cpl";

export default function Rentable({ registros, ventas, ingresosUsd, regalosUsd, gastoUsd }: { registros: number; ventas: number; ingresosUsd: number; regalosUsd: number; gastoUsd: number | null }) {
  const [cpl, setCpl] = useState(1276);
  const [rate, setRate] = useState(950);
  useEffect(() => {
    try { const v = Number(localStorage.getItem(KEY)); if (v > 0) setCpl(v); } catch {}
    fetch("/api/pagos").then((r) => r.json()).then((d) => { if (Number(d?.usdClp) > 0) setRate(Number(d.usdClp)); }).catch(() => {});
  }, []);
  const save = (v: number) => { setCpl(v); try { localStorage.setItem(KEY, String(v)); } catch {} };

  // the period, as it is
  const gastoMeta = gastoUsd != null && gastoUsd > 0 ? gastoUsd * rate : registros * cpl;
  const regalos = regalosUsd * rate;
  const costo = gastoMeta + regalos;
  const netos = (ingresosUsd / IVA) * (1 - MP) * rate;
  const resultado = netos - costo;
  const faltan = (p: (typeof PLANES)[number]) => Math.max(0, Math.ceil(-resultado / (p.peor * rate)));
  // real average once there are enough registrations; before that, the expected ~$2.300 (half the gift used)
  const regaloProm = registros >= 20 ? regalos / registros : 2300;

  // the simulator: 100 registrations at this cost
  const cien = 100 * (cpl + Math.max(regaloProm, 0));
  const need = (marginUsd: number, months: number) => Math.ceil(cien / (marginUsd * rate * months));

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-labelledby="rent-t">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="rent-t" className="font-display text-lg font-semibold">¿Vamos rentables?</h3>
          <p className="text-sm text-muted">En pesos. El costo de cada registro incluye lo que gastó en su anuncio de regalo.</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted">Costo por registro en Meta</span>
          <input type="number" min={0} step={1} value={cpl} onChange={(e) => save(Math.max(0, Number(e.target.value) || 0))}
            className="w-28 rounded-lg border border-line bg-surface-2 px-2 py-1 text-right tabular-nums" aria-label="Costo por registro en Meta, en pesos" />
        </label>
      </div>

      {/* this period, in order */}
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["1 · Registros", `${registros}`, `${clp(gastoMeta)} en Meta${gastoUsd ? "" : ` (a ${clp(cpl)} c/u)`}`],
          ["2 · Regalos usados", clp(regalos), registros ? `${clp(regalos / registros)} por registro` : "—"],
          ["3 · Costo por lead", registros ? clp(costo / registros) : "—", `Meta + regalo · total ${clp(costo)}`],
          ["4 · Pagaron", `${ventas}`, registros ? `${((ventas / registros) * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })}% de los registros` : "—"],
        ].map(([k, v, h]) => (
          <li key={k} className="flex flex-col gap-0.5 rounded-xl border border-line bg-surface-2 p-3">
            <span className="text-xs font-semibold text-muted">{k}</span>
            <b className="font-display text-2xl tabular-nums">{v}</b>
            <span className="text-xs text-muted">{h}</span>
          </li>
        ))}
      </ol>
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${resultado >= 0 ? "border-good/40 bg-good/10" : "border-warn/40 bg-warn/10"}`}>
        <p className="text-sm">
          <b>{resultado >= 0 ? "Vamos ganando" : "Todavía no se recupera"}: {clp(resultado)}</b>
          <span className="text-muted"> · ventas netas {clp(netos)} (sin IVA ni comisión) − costo {clp(costo)}</span>
        </p>
        {resultado < 0 && <p className="text-sm">Para empatar faltan <b>{faltan(PLANES[0])} Básico</b> o <b>{faltan(PLANES[1])} Emprende</b> <span className="text-muted">(primer mes, peor caso)</span></p>}
      </div>

      {/* the simulator */}
      <div className="flex flex-col gap-2">
        <h4 className="font-semibold">Si llegan 100 registros a {clp(cpl)}</h4>
        <p className="text-sm text-muted">Costo: {clp(100 * cpl)} en Meta + {clp(100 * regaloProm)} en regalos = <b className="text-ink">{clp(cien)}</b>. Cuántos de esos 100 tienen que pagar para no perder:</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead className="text-left text-xs text-muted">
              <tr><th className="py-2 font-semibold">Si pagan…</th><th className="font-semibold">Solo el 1er mes</th><th className="font-semibold">Si se quedan 3 meses</th><th className="font-semibold">Nos deja al mes</th></tr>
            </thead>
            <tbody>
              {PLANES.map((p) => (
                <tr key={p.id} className="border-t border-line">
                  <td className="py-2 font-semibold">{p.name} US${p.usd}</td>
                  <td className="tabular-nums">{need(p.peor, 1)} a {need(p.normal, 1)}</td>
                  <td className="tabular-nums"><b>{need(p.peor, 3)} a {need(p.normal, 3)}</b></td>
                  <td className="tabular-nums text-muted">{clp(p.peor * rate)} a {clp(p.normal * rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted">Rango: el primer número es si el cliente gasta todos sus créditos (peor caso) y el segundo si gasta la mitad (lo normal). Dólar a {clp(rate)}. Sin IVA (19%) ni comisión de Mercado Pago (~4,15%).</p>
      </div>
    </section>
  );
}
