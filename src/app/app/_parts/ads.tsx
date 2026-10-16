"use client";

import Link from "next/link";
import { useState } from "react";
import { formatById } from "@/lib/formats";
import { DeleteButton, Empty, PageHead, type Row, SetupNotice, btnCls, useTable } from "./ui";

interface Ad extends Row { title: string | null; format: string | null; aspect: string | null; model: string | null; status: string; final_url: string | null; favorite: boolean }

const STATUS: Record<string, [string, string]> = {
  draft: ["Borrador", "bg-surface-2 text-muted"],
  generating: ["Generando", "bg-accent/15 text-accent-text"],
  review: ["Para revisar", "bg-warn/15 text-warn"],
  done: ["Terminado", "bg-good/15 text-good"],
  failed: ["Con errores", "bg-bad/15 text-bad"],
};

export default function Ads({ mode }: { mode: "work" | "done" }) {
  const t = useTable<Ad>("ads");
  const [fav, setFav] = useState(false);
  const rows = (t.rows ?? []).filter((a) => (mode === "done" ? a.status === "done" : a.status !== "done")).filter((a) => !fav || a.favorite);

  return (
    <>
      <PageHead
        title={mode === "done" ? "Anuncios terminados" : "Videos"}
        lead={mode === "done" ? "Tus anuncios listos para subir a Meta o TikTok." : "Los anuncios que estás produciendo: cada uno con sus cortes y su estado."}
      >
        <div className="flex items-center gap-2">
          {mode === "done" && (
            <button type="button" onClick={() => setFav(!fav)} aria-pressed={fav} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${fav ? "border-accent text-accent-text" : "border-line text-muted"}`}>★ Favoritos</button>
          )}
          <Link href="/app/crear" className={btnCls}>+ Crear anuncio</Link>
        </div>
      </PageHead>
      {t.missing && <SetupNotice />}
      {t.rows === null ? <p className="text-muted">Cargando…</p> : rows.length === 0 && !t.missing ? (
        <Empty
          title={mode === "done" ? (fav ? "Sin favoritos todavía" : "Todavía no hay anuncios terminados") : "No hay videos en producción"}
          text={mode === "done" ? "Cuando un anuncio quede armado con voz y subtítulos, aparece aquí." : "Crea un anuncio desde tu guion y aquí vas a ver cómo avanza cada corte."}
        >
          <Link href="/app/crear" className={btnCls}>Crear anuncio</Link>
        </Empty>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
          {rows.map((a) => {
            const f = formatById(a.format ?? "ugc");
            const [label, cls] = STATUS[a.status] ?? STATUS.draft;
            return (
              <li key={a.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="grid aspect-[9/16] max-h-80 place-items-center bg-surface-2">
                  {a.final_url ? <video src={a.final_url} controls playsInline className="h-full w-full object-cover" /> : <span className="text-4xl" aria-hidden="true">{f.icon}</span>}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/app/videos/${a.id}`} className="line-clamp-2 font-bold hover:underline">{a.title || "Sin título"}</Link>
                    <button type="button" onClick={() => t.update(a.id, { favorite: !a.favorite })} aria-label={a.favorite ? "Quitar de favoritos" : "Agregar a favoritos"} className={a.favorite ? "text-warn" : "text-muted"}>★</button>
                  </div>
                  <span className="text-xs text-muted">{f.name} · {a.aspect ?? "9:16"} · {new Date(a.created_at).toLocaleDateString("es-CL")}</span>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <Link href={`/app/videos/${a.id}`} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label} →</Link>
                    <DeleteButton onDelete={() => t.remove(a.id)} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
