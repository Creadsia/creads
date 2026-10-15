"use client";

import { useEffect, useState } from "react";

// The real "Tres cotizaciones" script, cut the way Creads cuts it, with captions in reel-sized chunks.
const CUTS: { tipo: string; chunks: string[] }[] = [
  { tipo: "Hook", chunks: ["We got three quotes", "before repairing", "our foundation…"] },
  { tipo: "Dolor", chunks: ["The first company", "wanted $34,000"] },
  { tipo: "Agitación", chunks: ["The second: $26,000", "but only if I pay", "that same day"] },
  { tipo: "Historia", chunks: ["Then I overheard", "some customers", "at the store"] },
  { tipo: "Giro", chunks: ["The number he told me…", "I almost dropped", "my phone"] },
  { tipo: "Mecanismo", chunks: ["You put in your zip", "and see all the quotes"] },
  { tipo: "Prueba", chunks: ["The cracks are gone", "and the house", "feels incredible"] },
  { tipo: "CTA", chunks: ["Link below this video", "put in your zip"] },
];

export default function AdPhone() {
  const [pos, setPos] = useState({ cut: 0, chunk: 0 });
  const { cut, chunk } = pos;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setPos((p) =>
        p.chunk < CUTS[p.cut].chunks.length - 1
          ? { cut: p.cut, chunk: p.chunk + 1 }
          : { cut: (p.cut + 1) % CUTS.length, chunk: 0 },
      );
    }, 1100);
    return () => clearInterval(t);
  }, []);

  return (
    <figure className="mx-auto flex w-full max-w-[320px] flex-col gap-4" aria-label="Ejemplo de anuncio generado por Creads">
      {/* 9:16 phone with Meta ad chrome */}
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[2.2rem] border-[6px] border-[#0e1116] bg-[#0e1116] shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)]">
        {/* the "selfie": a warm porch at golden hour, drawn with light instead of a stock photo */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 70% at 70% 15%, #f7c98b 0%, #c98a5a 28%, #6b4a3a 55%, #2b2226 100%)",
          }}
        />
        {/* out-of-focus presenter: head and shoulders, the way a selfie reads at a glance */}
        <div
          className="absolute left-1/2 top-[24%] h-[24%] w-[38%] -translate-x-1/2 rounded-[48%] opacity-85 blur-[2px]"
          style={{ background: "radial-gradient(65% 60% at 50% 40%, #a7745c 0%, #5b3d33 75%, #3b2a27 100%)" }}
        />
        <div
          className="absolute left-1/2 top-[46%] h-[60%] w-[92%] -translate-x-1/2 rounded-t-[48%] opacity-90 blur-[2px]"
          style={{ background: "linear-gradient(180deg, #3d4a5c 0%, #263040 60%, #1a2029 100%)" }}
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

        {/* top: page + Sponsored */}
        <div className="absolute inset-x-0 top-0 flex items-center gap-2 px-4 pt-4 text-[11px] text-white">
          <span className="h-7 w-7 rounded-full bg-white/90" />
          <span className="leading-tight">
            <b className="block font-semibold">HomeQuotes</b>
            <span className="opacity-80">Sponsored</span>
          </span>
        </div>

        {/* captions */}
        <p key={`${cut}-${chunk}`} className="caption absolute inset-x-5 top-[58%] text-center text-[1.65rem]">
          {CUTS[cut].chunks[chunk].split(" ").map((w, i, arr) => (
            <span key={i} className={i === arr.length - 1 ? "text-caption" : undefined}>
              {w}
              {i < arr.length - 1 ? " " : ""}
            </span>
          ))}
        </p>

        {/* bottom CTA bar */}
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-xl bg-white/95 px-3 py-2 text-[11px] text-[#1c1e21]">
          <span className="leading-tight">
            <span className="block opacity-70">homequotes.example</span>
            <b className="font-semibold">See prices in your zip</b>
          </span>
          <span className="rounded-md bg-[#e4e6eb] px-2.5 py-1.5 font-semibold">Get Quote</span>
        </div>
      </div>

      {/* cut strip: which of the 8 cuts is playing */}
      <figcaption className="flex flex-col gap-2">
        <div className="flex gap-1" aria-hidden="true">
          {CUTS.map((c, i) => (
            <span
              key={c.tipo}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i === cut ? "bg-accent" : i < cut ? "bg-muted/60" : "bg-line"}`}
            />
          ))}
        </div>
        <p className="text-sm text-muted">
          Corte {cut + 1} de {CUTS.length} · <span className="text-ink">{CUTS[cut].tipo}</span> · máx. 8 s por corte
        </p>
      </figcaption>
    </figure>
  );
}
