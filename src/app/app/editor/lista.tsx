"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHead } from "../_parts/ui";

// «Editor» as its own section (owner's brief, 25 Oct 2026): pick any finished video and give it the final touch.
// Editing never uses balance; only AI steps (a new voice, a regenerated scene) do, and they show their cost first.

interface Ad { id: string; title: string | null; final_url: string | null; status: string; format: string | null; aspect: string | null; created_at: string; settings: Record<string, unknown> | null }

export default function Lista() {
  const [ads, setAds] = useState<Ad[] | null>(null);
  useEffect(() => {
    fetch("/api/data/ads").then((r) => (r.ok ? r.json() : null)).then((d) => setAds(((d?.rows ?? []) as Ad[]).filter((a) => a.final_url && a.format !== "historia" && !(a.settings as { demo?: boolean } | null)?.demo))).catch(() => setAds([]));
  }, []);
  return (
    <>
      <PageHead title="Editor" lead="Dale la terminación final a tus videos: subtítulos, textos, música, voces y cortes. Editar no gasta saldo." />
      {!ads ? <p className="text-muted">Cargando tus videos…</p> : ads.length === 0 ? (
        <section className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line p-6">
          <b className="text-lg">Todavía no tienes videos para editar</b>
          <p className="text-sm text-muted">Cuando termines un video con avatar, aparece aquí para darle la terminación final.</p>
          <Link href="/app/automatico" className="inline-flex min-h-11 items-center rounded-xl bg-[image:var(--grad)] px-4 font-semibold text-white">Hacer un video con avatar</Link>
        </section>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {ads.map((a) => (
            <li key={a.id}>
              <Link href={`/app/editor/${a.id}`} className="group flex flex-col gap-2">
                <span className="relative block aspect-[9/16] overflow-hidden rounded-xl border border-line bg-surface-2">
                  <video src={`${a.final_url}#t=0.5`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                  <span className="absolute inset-x-2 bottom-2 rounded-lg bg-black/70 px-2 py-1.5 text-center text-[13px] font-semibold text-white opacity-90 group-hover:opacity-100">Editar</span>
                </span>
                <span className="line-clamp-2 text-sm font-semibold">{a.title || "Sin título"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
