"use client";

import Image from "next/image";
import { useState } from "react";
import { IDEAS_PORTADA, RUBROS, type Rubro } from "@/lib/ideas";

// Home page examples: real ads made with Creads, filterable by industry, each with the name of its format.

export default function Ejemplos() {
  const [rubro, setRubro] = useState<Rubro | "todos">("todos");
  const shown = IDEAS_PORTADA.filter((i) => rubro === "todos" || i.rubro === rubro);
  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="Rubro" className="scroll-row flex gap-2 overflow-x-auto pb-1">
        {([{ id: "todos", label: "Todos" }, ...RUBROS] as const).map((r) => (
          <button key={r.id} type="button" role="radio" aria-checked={rubro === r.id} onClick={() => setRubro(r.id)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${rubro === r.id ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}>{r.label}</button>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {shown.map((i) => (
          <li key={i.id} className="group flex flex-col gap-1.5">
            <div className="relative aspect-[4/5] overflow-hidden rounded-xl border border-line bg-surface-2">
              <Image src={i.src} alt={`Anuncio de ${i.tipo.toLowerCase()} hecho con Creads`} fill sizes="(min-width: 1024px) 180px, (min-width: 640px) 30vw, 46vw" className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
            </div>
            <span className="text-sm font-semibold leading-tight">{i.tipo}</span>
            <span className="text-xs text-muted">{RUBROS.find((r) => r.id === i.rubro)?.label} · {i.idioma === "en" ? "Inglés" : "Español"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
