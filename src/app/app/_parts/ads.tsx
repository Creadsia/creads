"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NICHES, cleanNiche, nicheKey } from "@/lib/niches";
import { formatById } from "@/lib/formats";
import { DeleteButton, Empty, PageHead, type Row, SetupNotice, btnCls, useTable } from "./ui";
import ImageLibrary from "./image-library";
import SubtitleEditor from "./subtitle-editor";

interface Ad extends Row { title: string | null; format: string | null; aspect: string | null; model: string | null; status: string; final_url: string | null; favorite: boolean; settings: Record<string, unknown> | null }

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
  const [niche, setNiche] = useState<string | null>(null); // nicheKey, or null = all
  const [editing, setEditing] = useState<string | null>(null);
  const [kind, setKind] = useState<"videos" | "imagenes">("videos"); // «Anuncios terminados»: videos or images
  const [subs, setSubs] = useState<Ad | null>(null); // the ad whose subtitles are being edited
  const nicheOf = (a: Ad) => cleanNiche(a.settings?.niche);
  // an ad being redone shows in both: in production, and finished (its last final video) until rebuilt
  const mine = (t.rows ?? []).filter((a) => (mode === "done" ? a.status === "done" || Boolean(a.final_url) : a.status !== "done"));
  // niches in use, with how many ads each (same niche written differently counts once)
  const niches = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const a of mine) {
      const label = nicheOf(a) || "Sin nicho";
      const k = nicheKey(label);
      m.set(k, { label: m.get(k)?.label ?? label, n: (m.get(k)?.n ?? 0) + 1 });
    }
    return [...m.entries()].sort((a, b) => (a[1].label === "Sin nicho" ? 1 : b[1].label === "Sin nicho" ? -1 : b[1].n - a[1].n));
  }, [mine]);
  const rows = mine.filter((a) => !fav || a.favorite).filter((a) => !niche || nicheKey(nicheOf(a) || "Sin nicho") === niche);
  const saveNiche = (a: Ad, v: string) => { t.update(a.id, { niche: cleanNiche(v) || null }); setEditing(null); };

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
      {mode === "done" && (
        <div role="tablist" aria-label="Tipo" className="flex w-fit rounded-lg border border-line p-0.5 text-sm">
          {([["videos", "Videos"], ["imagenes", "Imágenes"]] as const).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)} className={`rounded-md px-4 py-1.5 font-semibold ${kind === k ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>{l}</button>
          ))}
        </div>
      )}
      {mode === "done" && kind === "imagenes" ? <ImageLibrary /> : <>
      {niches.length > 1 && (
        <div role="group" aria-label="Filtrar por nicho" className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setNiche(null)} aria-pressed={!niche} className={`rounded-full border px-3 py-1 text-sm font-semibold ${!niche ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}>Todos · {mine.length}</button>
          {niches.map(([k, v]) => (
            <button key={k} type="button" onClick={() => setNiche(niche === k ? null : k)} aria-pressed={niche === k}
              className={`rounded-full border px-3 py-1 text-sm font-semibold ${niche === k ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}>{v.label} · {v.n}</button>
          ))}
        </div>
      )}
      <datalist id="niche-list">{[...new Set([...niches.map(([, v]) => v.label).filter((l) => l !== "Sin nicho"), ...NICHES])].map((n) => <option key={n} value={n} />)}</datalist>
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
            const story = a.format === "historia";
            const f = story ? { name: "Historia animada", icon: "🎬" } : formatById(a.format ?? "ugc");
            const href = story ? `/app/historias?id=${a.id}` : `/app/videos/${a.id}`;
            const [label, cls] = STATUS[a.status] ?? STATUS.draft;
            return (
              <li key={a.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="grid aspect-[9/16] max-h-80 place-items-center bg-surface-2">
                  {a.final_url ? <video src={a.final_url} controls playsInline className="h-full w-full object-cover" /> : <span className="text-4xl" aria-hidden="true">{f.icon}</span>}
                </div>
                <div className="flex flex-1 flex-col gap-1 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={href} className="line-clamp-2 font-bold hover:underline">{a.title || "Sin título"}</Link>
                    <button type="button" onClick={() => t.update(a.id, { favorite: !a.favorite })} aria-label={a.favorite ? "Quitar de favoritos" : "Agregar a favoritos"} className={a.favorite ? "text-warn" : "text-muted"}>★</button>
                  </div>
                  <span className="text-xs text-muted">{f.name} · {a.aspect ?? "9:16"} · {new Date(a.created_at).toLocaleDateString("es-CL")}</span>
                  {editing === a.id ? (
                    <form onSubmit={(e) => { e.preventDefault(); saveNiche(a, String(new FormData(e.currentTarget).get("n") ?? "")); }} className="flex gap-1">
                      <input name="n" defaultValue={nicheOf(a)} list="niche-list" autoFocus aria-label="Nicho" placeholder="Nicho" className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-xs" />
                      <button type="submit" className="text-xs font-semibold text-accent-text">Guardar</button>
                    </form>
                  ) : (
                    <button type="button" onClick={() => setEditing(a.id)} className="self-start rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold text-muted hover:text-ink">
                      {nicheOf(a) || "+ Agregar nicho"}
                    </button>
                  )}
                  {a.final_url && !story && (
                    <button type="button" onClick={() => setSubs(a)} className="mt-1 w-fit rounded-lg border border-line px-3 py-1.5 text-xs font-semibold hover:border-ink">✏️ Editar o mover subtítulos</button>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <Link href={href} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label} →</Link>
                    <DeleteButton onDelete={() => t.remove(a.id)} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </>}
      {subs?.final_url && (
        <SubtitleEditor adId={subs.id} video={subs.final_url} title={subs.title || "Sin título"} aspect={subs.aspect ?? "9:16"} onClose={() => setSubs(null)}
          onDone={() => { t.reload(); }} />
      )}
    </>
  );
}
