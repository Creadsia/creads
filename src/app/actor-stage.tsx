"use client";

import { useEffect, useState } from "react";

// Hero «escenario de actores» (owner, 10 nov 2026: «cosas novedosas, no lo que se ve en cualquier lado»).
// Idea única de Creads: el MISMO lugar de anuncio, con el actor IA que quieras. El video principal va cambiando
// de actor solo (crossfade), y el visitante puede elegir la cara en la tira de miniaturas. Vende lo único nuestro
// —actores infinitos sin grabar— en vez del típico muro de videos. Todos corren muteados y en loop.

export type ActorClip = { src: string; poster: string; label: string };

export default function ActorStage({ clips }: { clips: ActorClip[] }) {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto || clips.length < 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setI((x) => (x + 1) % clips.length), 3800);
    return () => clearInterval(t);
  }, [auto, clips.length]);

  if (!clips.length) return null;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row-reverse sm:items-center sm:justify-center sm:gap-6">
      {/* Escenario principal: todos los videos apilados, solo el activo visible (crossfade). */}
      <div className="relative aspect-[9/16] w-56 shrink-0 overflow-hidden rounded-[1.8rem] border border-white/10 bg-black shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)] sm:w-[19rem]">
        {clips.map((c, k) => (
          <video
            key={c.src}
            src={c.src}
            poster={c.poster}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${k === i ? "opacity-100" : "opacity-0"}`}
          />
        ))}
        {/* línea de "generando" que barre, sutil, marca de Creads */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-[image:var(--grad)] opacity-80" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-[image:var(--grad)]" />{clips[i].label}
        </div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/55 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur">
          Actor {i + 1} de {clips.length} · IA
        </div>
      </div>

      {/* Tira de actores: elige la cara. Fila en celular, columna en desktop. */}
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1 sm:flex-col sm:overflow-visible sm:pb-0">
        {clips.map((c, k) => (
          <button
            key={c.src}
            type="button"
            onClick={() => { setI(k); setAuto(false); }}
            aria-label={`Ver actor: ${c.label}`}
            aria-pressed={k === i}
            className={`relative shrink-0 rounded-xl transition ${k === i ? "bg-[image:var(--grad)] p-[2px]" : "p-[2px] opacity-55 hover:opacity-100"}`}
          >
            <span className="block overflow-hidden rounded-[10px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- static poster thumbnail */}
              <img src={c.poster} alt="" className="h-14 w-14 object-cover sm:h-16 sm:w-16" loading="lazy" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
