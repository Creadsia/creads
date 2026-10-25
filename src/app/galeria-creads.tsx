"use client";

import { useState } from "react";
import { type GaleriaPublicaItem, filtrarPorNicho, nichosConItems } from "@/lib/confianza";
import DemoPhone from "./demo-phone";
import LoopVideo from "./loop-video";

// «Hecho con Creads»: real outputs the owner uploaded in Panel → Marketing → Portada, filtered by niche.
// No items → nothing at all (golden rule: never an empty block). Chips only for niches that have items.
// Videos play silently while on screen (DemoPhone / LoopVideo), images load lazily.

export default function GaleriaCreads({
  items,
  titulo = "Hecho con Creads",
  bajada = "Anuncios reales hechos en Creads, por nicho.",
  className = "",
}: {
  /** From `galeriaPublica()` (server). */
  items: GaleriaPublicaItem[];
  titulo?: string;
  /** One line under the title; "" hides it. */
  bajada?: string;
  className?: string;
}) {
  const [nicho, setNicho] = useState("todos");
  if (!items.length) return null;
  const nichos = nichosConItems(items);
  const shown = filtrarPorNicho(items, nichos.some(([k]) => k === nicho) ? nicho : "todos");
  const chip = (on: boolean) =>
    `flex-none rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${on ? "border-transparent bg-ink text-bg" : "border-line text-muted hover:text-ink"}`;

  return (
    <section aria-labelledby="galeria-creads" className={`flex flex-col gap-5 ${className}`}>
      <div className="flex flex-col gap-1.5">
        <h2 id="galeria-creads" className="font-display text-[1.7rem] leading-[1.1] font-semibold sm:text-[2.3rem]">{titulo}</h2>
        {bajada && <p className="text-muted">{bajada}</p>}
      </div>
      {nichos.length > 1 && (
        <div role="group" aria-label="Filtrar por nicho" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <button type="button" aria-pressed={nicho === "todos"} onClick={() => setNicho("todos")} className={chip(nicho === "todos")}>Todos</button>
          {nichos.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={nicho === k} onClick={() => setNicho(k)} className={chip(nicho === k)}>{l}</button>
          ))}
        </div>
      )}
      <ul className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {shown.map((i) => (
          <li key={i.id} className="flex min-w-0 flex-col gap-2">
            <Tile i={i} />
            <div className="flex min-w-0 flex-col gap-0.5 px-0.5">
              <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">{i.tipoLabel} · {i.nichoLabel}</span>
              {i.caption && <p className="text-sm leading-snug">{i.caption}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tile({ i }: { i: GaleriaPublicaItem }) {
  const alt = i.caption || `${i.tipoLabel} de ${i.nichoLabel.toLowerCase()} hecho con Creads`;
  if (i.media === "video" && i.formato === "9:16") return <DemoPhone src={i.src} poster={i.poster ?? ""} label="" />;
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line bg-surface-2 ${i.formato === "9:16" ? "aspect-[9/16]" : "aspect-[4/5]"}`}>
      {i.media === "video" ? (
        <LoopVideo src={i.src} poster={i.poster} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a redirect to a short-lived storage link; next/image can't cache it
        <img src={i.src} alt={alt} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      )}
    </div>
  );
}
