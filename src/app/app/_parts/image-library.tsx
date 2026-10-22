"use client";

import Link from "next/link";
import { DeleteButton, Empty, btnCls, useTable, dl } from "./ui";
import type { Img } from "./tool-run";

// «Anuncios terminados» → Imágenes: every image the account made (studio, Automático, the connector),
// newest first, to download or delete. Same table the image tools save to.
export default function ImageLibrary() {
  const t = useTable<Img & { aspect?: string | null }>("images");
  if (t.rows === null) return <p className="text-muted">Cargando…</p>;
  if (!t.rows.length) {
    return (
      <Empty title="Todavía no hay imágenes" text="Las imágenes que hagas en «Imágenes para anuncios» o en Automático quedan guardadas aquí.">
        <Link href="/app/laboratorio" className={btnCls}>Hacer imágenes</Link>
      </Empty>
    );
  }
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
      {t.rows.map((im) => (
        <li key={im.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
          <a href={im.url} target="_blank" rel="noreferrer" className="block bg-surface-2" title="Abrir en grande">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.url} alt={im.prompt?.slice(0, 120) || "Imagen de Creads"} loading="lazy" className="max-h-80 w-full object-cover" />
          </a>
          <div className="flex flex-1 flex-col gap-1 p-3">
            {im.prompt && <p className="line-clamp-2 text-xs text-muted">{im.prompt}</p>}
            <span className="text-xs text-muted">{im.aspect ? `${im.aspect} · ` : ""}{new Date(im.created_at).toLocaleDateString("es-CL")}</span>
            <div className="mt-auto flex items-center justify-between pt-2">
              <a href={dl(im.url)} download target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent-text">Descargar</a>
              <DeleteButton onDelete={() => t.remove(im.id)} />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
