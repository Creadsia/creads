"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHead } from "../_parts/ui";

// «Editor» as its own section (owner's brief, 25 Oct 2026): pick any finished video and give it the final touch.
// Editing never uses balance; only AI steps (a new voice, a regenerated scene) do, and they show their cost first.

interface Ad { id: string; title: string | null; final_url: string | null; status: string; format: string | null; aspect: string | null; created_at: string; settings: Record<string, unknown> | null }

const fecha = (s: string) => { const d = new Date(s); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("es-CL", { day: "numeric", month: "short" }); };

export default function Lista({ inicial }: { inicial?: Ad[] }) {
  const [ads, setAds] = useState<Ad[] | null>(inicial ?? null);
  useEffect(() => {
    if (inicial) return;
    fetch("/api/data/ads").then((r) => (r.ok ? r.json() : null)).then((d) => setAds(((d?.rows ?? []) as Ad[]).filter((a) => a.final_url && a.format !== "historia" && !(a.settings as { demo?: boolean } | null)?.demo))).catch(() => setAds([]));
  }, [inicial]);
  return (
    <>
      <PageHead title="Editor" lead="Dale la terminación final a tus videos: cortes, textos, subtítulos, música y formato. Editar no gasta saldo." />
      {!ads ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5" aria-label="Cargando tus videos">
          {Array.from({ length: 5 }, (_, i) => <li key={i} className="aspect-[9/16] animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />)}
        </ul>
      ) : ads.length === 0 ? (
        <section className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line p-6">
          <b className="text-lg">Todavía no tienes videos para editar</b>
          <p className="text-sm text-muted">Cuando termines un video con avatar, aparece aquí para darle la terminación final.</p>
          <Link href="/app/automatico" className="inline-flex min-h-11 items-center rounded-xl bg-[image:var(--grad)] px-4 font-semibold text-white">Hacer un video con avatar</Link>
        </section>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {ads.map((a) => (
            <li key={a.id} className="min-w-0">
              <Link href={`/app/editor/${a.id}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition-colors hover:border-ink/30">
                <span className="relative block aspect-[9/16] overflow-hidden bg-black">
                  <video src={`${a.final_url}#t=0.5`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03] motion-reduce:transition-none" />
                  <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/70 to-transparent" />
                  {a.aspect && <span className="absolute top-2 left-2 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-white">{a.aspect}</span>}
                </span>
                <span className="flex flex-1 flex-col gap-2 p-3">
                  <span className="line-clamp-2 text-sm leading-snug font-semibold">{a.title || "Sin título"}</span>
                  <span className="mt-auto flex items-center justify-between gap-2">
                    <span className="text-[13px] text-muted">{fecha(a.created_at)}</span>
                    <span className="inline-flex min-h-9 items-center rounded-lg bg-[image:var(--grad)] px-3 text-[13px] font-semibold text-white">Editar</span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
