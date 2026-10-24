"use client";

import { useEffect, useState } from "react";

// «Ver qué hizo»: one customer's latest images, ads, failures and credit movements (owner, 24 Oct 2026).

interface Data {
  imagenes: { url: string | null; prompt: string; modelo: string | null; creada: string }[];
  anuncios: { titulo: string; estado: string; formato: string | null; video: string | null; creado: string }[];
  fallas: { que: string; modelo: string | null; error: string; texto: string; cuando: string }[];
  generaciones: number;
  movimientos: { creditos: number; tipo: string; nota: string; cuando: string }[];
}
const when = (iso: string) => new Date(iso).toLocaleString("es-CL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ESTADO: Record<string, string> = { done: "listo", draft: "borrador", generating: "generando", failed: "falló" };

export default function Actividad({ ws }: { ws: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fetch(`/api/admin/actividad?ws=${encodeURIComponent(ws)}`).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setD(j); }).catch((e) => setErr(e.message || "No se pudo cargar."));
  }, [ws]);
  if (err) return <p className="text-sm text-bad">{err}</p>;
  if (!d) return <p className="text-sm text-muted">Cargando…</p>;
  const nada = !d.imagenes.length && !d.anuncios.length && !d.fallas.length && !d.movimientos.length;
  if (nada) return <p className="text-sm text-muted">Todavía no ha generado nada.</p>;
  return (
    <div className="flex flex-col gap-4 text-sm">
      {d.fallas.length > 0 && (
        <div className="rounded-xl border border-bad/40 bg-bad/10 p-3">
          <b>Tuvo {d.fallas.length} {d.fallas.length === 1 ? "problema" : "problemas"}</b> <span className="text-muted">(los créditos de lo que falla vuelven solos)</span>
          <ul className="mt-2 flex flex-col gap-1.5">
            {d.fallas.map((f, i) => <li key={i}><span className="text-muted">{when(f.cuando)} · {f.que}{f.modelo ? ` · ${f.modelo}` : ""}:</span> {f.error || "falló"}{f.texto && <span className="block text-xs text-muted">«{f.texto}»</span>}</li>)}
          </ul>
        </div>
      )}
      {d.anuncios.length > 0 && (
        <div>
          <b>Anuncios ({d.anuncios.length})</b>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {d.anuncios.map((a, i) => (
              <li key={i} className="flex flex-col gap-1 rounded-lg border border-line p-2">
                {a.video ? <video src={a.video} controls playsInline preload="none" className="aspect-[9/16] w-full rounded bg-black object-cover" /> : <span className="grid aspect-[9/16] place-items-center rounded bg-surface-2 text-xs text-muted">{ESTADO[a.estado] ?? a.estado}</span>}
                <span className="truncate font-semibold" title={a.titulo}>{a.titulo}</span>
                <span className="text-xs text-muted">{when(a.creado)} · {ESTADO[a.estado] ?? a.estado}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.imagenes.length > 0 && (
        <div>
          <b>Imágenes ({d.imagenes.length})</b>
          <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {d.imagenes.map((im, i) => (
              <li key={i} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {im.url ? <a href={im.url} target="_blank" rel="noopener noreferrer"><img src={im.url} alt="" className="aspect-square w-full rounded object-cover" /></a> : <span className="aspect-square rounded bg-surface-2" />}
                <span className="line-clamp-2 text-[11px] text-muted" title={im.prompt}>{im.prompt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {d.movimientos.length > 0 && (
        <details>
          <summary className="cursor-pointer font-semibold">Créditos: movimientos ({d.movimientos.length})</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {d.movimientos.map((m, i) => <li key={i} className="flex gap-3"><span className={`w-14 shrink-0 text-right font-mono tabular-nums ${m.creditos > 0 ? "text-good" : ""}`}>{m.creditos > 0 ? "+" : ""}{m.creditos}</span><span className="text-muted">{when(m.cuando)}</span><span>{m.nota}</span></li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
