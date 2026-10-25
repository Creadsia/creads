"use client";

import { useEffect, useState } from "react";
import type { FilaTipo, ResumenImagenes } from "@/lib/calidad-imagen";
import { nombrePieza } from "@/lib/control-imagen";

// Plataforma → Calidad → Imágenes con «Control»: how many pieces came out right on the first try (QA passed
// and the customer didn't ask for a free redo), per type of piece and style. Goal: 90%.

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);

function Tabla({ filas, nombre, meta }: { filas: FilaTipo[]; nombre: (k: string) => string; meta: number }) {
  if (!filas.length) return <p className="text-sm text-muted">Sin imágenes en este periodo.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-sm">
        <thead><tr className="text-left text-muted"><th className="py-1 pr-2 font-semibold">Pieza</th><th className="py-1 pr-2 font-semibold">Bien al primer intento</th><th className="py-1 pr-2 font-semibold">Rehechos automáticos</th><th className="py-1 font-semibold">Rehechos pedidos</th></tr></thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.tipo} className="border-t border-line">
              <td className="py-1.5 pr-2 font-semibold">{nombre(f.tipo)}</td>
              <td className={`py-1.5 pr-2 tabular-nums ${f.tasa != null && f.tasa < meta ? "text-bad" : "text-good"}`}>{pct(f.tasa)} <span className="text-muted">({f.primerOk} de {f.piezas})</span></td>
              <td className="py-1.5 pr-2 tabular-nums">{f.auto}</td>
              <td className="py-1.5 tabular-nums">{f.manual}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CalidadImagenes() {
  const [dias, setDias] = useState(7);
  const [d, setD] = useState<ResumenImagenes | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    setErr("");
    fetch(`/api/admin/calidad-imagenes?dias=${dias}`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setErr(e.message || "No se pudo cargar."));
  }, [dias]);
  if (err) return <section className={card}><p className="text-bad">{err}</p></section>;
  if (!d) return <section className={card}><p className="text-muted">Cargando…</p></section>;
  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Imágenes con «Control»</h2>
          <p className="text-sm text-muted">Cada pieza se revisa sola antes de entregarla; si tiene un error grave se rehace gratis una vez. Cuenta como «bien al primer intento» si pasó la revisión a la primera y el cliente no pidió rehacerla. Meta: {pct(d.meta)}. Te llega un resumen por correo cada lunes.</p>
        </div>
        <select value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Periodo" className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
          <option value={7}>Últimos 7 días</option><option value={30}>Últimos 30 días</option><option value={90}>Últimos 90 días</option>
        </select>
      </div>
      <p className="text-2xl font-bold tabular-nums">{pct(d.total.tasa)} <span className="text-sm font-normal text-muted">bien al primer intento ({d.total.primerOk} de {d.total.piezas} piezas)</span></p>
      <h3 className="font-semibold">Por tipo de pieza</h3>
      <Tabla filas={d.porPieza} nombre={nombrePieza} meta={d.meta} />
      <h3 className="font-semibold">Por estilo</h3>
      <Tabla filas={d.porEstilo} nombre={(k) => k} meta={d.meta} />
      <h3 className="font-semibold">Motivos de rehechos</h3>
      {d.motivos.length === 0 ? <p className="text-sm text-muted">Ninguno en este periodo.</p> : (
        <ul className="flex flex-col gap-1 text-sm">{d.motivos.map((m) => <li key={m.motivo} className="flex justify-between gap-3"><span className="min-w-0">{m.motivo}</span><span className="tabular-nums text-muted">{m.veces}×</span></li>)}</ul>
      )}
      <p className="text-xs text-muted">Ediciones con instrucción: {d.ediciones.texto} de texto (gratis) y {d.ediciones.imagen} de imagen (pagadas).</p>
    </section>
  );
}
