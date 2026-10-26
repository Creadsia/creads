"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { IDEAS, RUBROS, type Rubro } from "@/lib/ideas";
import { PageHead } from "../_parts/ui";

// «Galería de ideas» (owner, 25 Oct 2026): real ads made with Creads, by industry and format, to take ideas
// from. It loads more as you scroll; «Hacer una así» opens a batch that uses that format for your product.

const PAGE = 12;

export default function Galeria() {
  const [rubro, setRubro] = useState<Rubro | "todos">("todos");
  const [idioma, setIdioma] = useState<"todos" | "es" | "en">("todos");
  const [n, setN] = useState(PAGE);
  const [copiado, setCopiado] = useState("");
  const fin = useRef<HTMLDivElement>(null);
  const lista = useMemo(() => IDEAS.filter((i) => (rubro === "todos" || i.rubro === rubro) && (idioma === "todos" || i.idioma === idioma)), [rubro, idioma]);

  useEffect(() => { setN(PAGE); }, [rubro, idioma]);
  useEffect(() => {
    const el = fin.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) setN((v) => Math.min(v + PAGE, lista.length)); }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [lista.length]);

  const chip = (on: boolean) => `shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold ${on ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`;

  return (
    <>
      <PageHead title="Galería de ideas" lead="Anuncios reales hechos con Creads, en formatos que se repiten entre los que más escalan. Elige uno y haz tus anuncios así para tu producto." />
      <div className="flex flex-col gap-2">
        <div className="scroll-row flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Rubro">
          {([{ id: "todos", label: "Todos" }, ...RUBROS] as const).map((r) => <button key={r.id} type="button" role="radio" aria-checked={rubro === r.id} onClick={() => setRubro(r.id)} className={chip(rubro === r.id)}>{r.label}</button>)}
        </div>
        <div className="flex gap-2" role="radiogroup" aria-label="Idioma">
          {([["todos", "Ambos idiomas"], ["es", "Español"], ["en", "Inglés"]] as const).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={idioma === k} onClick={() => setIdioma(k)} className={chip(idioma === k)}>{l}</button>)}
        </div>
      </div>

      <ul className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>li]:mb-3">
        {lista.slice(0, n).map((i) => (
          <li key={i.id} className="break-inside-avoid overflow-hidden rounded-2xl border border-line bg-surface">
            <div className={`relative ${i.formato === "9:16" ? "aspect-[9/16]" : "aspect-[4/5]"} bg-surface-2`}>
              <Image src={i.src} alt={`Anuncio de ${i.tipo.toLowerCase()}`} fill sizes="(min-width: 1024px) 260px, (min-width: 640px) 33vw, 50vw" className="object-cover" />
            </div>
            <div className="flex flex-col gap-2 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <b className="text-sm leading-tight">{i.tipo}</b>
                <span className="shrink-0 text-xs text-muted">{RUBROS.find((r) => r.id === i.rubro)?.label} · {i.formato} · {i.idioma.toUpperCase()}</span>
              </div>
              <p className="text-xs text-muted">{i.porque}</p>
              <div className="flex flex-wrap gap-1.5">
                <Link href={`/app/tanda?idea=${i.id}`} className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-ink">Hacer una así</Link>
                <button type="button" onClick={() => { navigator.clipboard?.writeText(i.brief).then(() => { setCopiado(i.id); setTimeout(() => setCopiado(""), 1500); }).catch(() => {}); }}
                  className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-ink">{copiado === i.id ? "Copiada" : "Copiar idea"}</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <div ref={fin} aria-hidden="true" />
      {n >= lista.length && <p className="text-center text-sm text-muted">Agregamos ideas nuevas cada semana.</p>}
    </>
  );
}
