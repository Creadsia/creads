"use client";

import { useCallback, useEffect, useState } from "react";
import type { Quality } from "@/lib/calidad";

// Plataforma → Calidad de videos: how «Mi personaje en un video» really turns out (clean on the first try,
// redone free by the review, delivered with a warning, failed), the problems the reviews found, why
// generations fail, and the rules learned from them (approve them to use them in every video).

const card = "flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:p-5";
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");

export default function Calidad() {
  const [dias, setDias] = useState(30);
  const [d, setD] = useState<Quality | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(() => {
    setErr("");
    fetch(`/api/admin/calidad?dias=${dias}`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setErr(e.message || "No se pudo cargar."));
  }, [dias]);
  useEffect(() => { load(); }, [load]);
  async function regla(body: Record<string, string>) {
    await fetch("/api/admin/calidad", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    load();
  }
  if (err) return <div className={card}><p className="text-bad">{err}</p></div>;
  if (!d) return <div className={card}><p className="text-muted">Cargando…</p></div>;
  const p = d.personaje;
  const terminados = p.listos + p.fallidos;

  return (
    <div className="flex flex-col gap-4">
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">Mi personaje en un video</h2>
            <p className="text-sm text-muted">Cada video se revisa dos veces (la escena y el video final). Si la revisión encuentra un error grave, se avisa (los rehechos gratis están apagados desde el 19 oct).</p>
          </div>
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Periodo" className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm">
            <option value={7}>Últimos 7 días</option><option value={30}>Últimos 30 días</option><option value={90}>Últimos 90 días</option>
          </select>
        </div>
        {p.total === 0 ? <p className="text-sm text-muted">Todavía no hay videos con personaje en este periodo.</p> : (
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([
              ["Salieron bien", pct(p.listos, terminados), `${p.listos} de ${terminados} terminados`],
              ["Limpios al primer intento", pct(p.limpios, terminados), `${p.limpios} sin rehacer nada`],
              ["Rehechos gratis", String(p.rehechosEscena + p.rehechosVideo), `${p.rehechosEscena} escena · ${p.rehechosVideo} video`],
              ["Fallaron (créditos devueltos)", String(p.fallidos), `${p.conAviso} entregados con aviso · ${p.enCurso} en curso`],
            ] as const).map(([k, v, sub]) => (
              <div key={k} className="flex flex-col gap-0.5 rounded-xl border border-line p-3">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-display text-2xl font-bold tabular-nums">{v}</dd>
                <dd className="text-xs text-muted">{sub}</dd>
              </div>
            ))}
          </dl>
        )}
        {p.problemas.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold">Lo que más encontró la revisión</h3>
            <ul className="flex flex-col gap-1 text-sm">
              {p.problemas.map((x) => <li key={x.texto} className="flex justify-between gap-3"><span className="min-w-0">{x.texto}</span><span className="shrink-0 tabular-nums text-muted">{x.veces}×</span></li>)}
            </ul>
          </div>
        )}
      </section>

      <section className={card}>
        <div>
          <h2 className="font-semibold">Reglas aprendidas por aprobar</h2>
          <p className="text-sm text-muted">Cada error que encuentra la revisión se convierte en una regla. Al aprobarla, se agrega a todos los videos con personaje para que no se repita.</p>
        </div>
        {d.reglasPendientes.length === 0 ? <p className="text-sm text-muted">No hay reglas nuevas esperando.</p> : (
          <ul className="flex flex-col gap-2">
            {d.reglasPendientes.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line p-3">
                <span className="min-w-0 text-sm" title={r.en}>{r.es}</span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => regla({ aprobar: r.id })} className="rounded-lg bg-ink px-3 py-1.5 text-sm font-semibold text-bg">Aprobar</button>
                  <button type="button" onClick={() => regla({ descartar: r.id })} className="rounded-lg border border-line px-3 py-1.5 text-sm">Descartar</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <div>
          <h2 className="font-semibold">Por qué fallan las generaciones</h2>
          <p className="text-sm text-muted">Todas las herramientas y modelos, agrupando el mismo error. Lo de arriba es lo que más conviene arreglar.</p>
        </div>
        {d.motivos.length === 0 ? <p className="text-sm text-muted">Sin fallas en este periodo.</p> : (
          <ul className="flex flex-col gap-2">
            {d.motivos.map((m, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-line pb-2 text-sm last:border-0">
                <span className="min-w-0"><b>{m.herramienta}</b> <span className="text-muted">— {m.texto}</span></span>
                <span className="shrink-0 tabular-nums text-muted">{m.veces}×</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
