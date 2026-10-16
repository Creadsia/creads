"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatById } from "@/lib/formats";
import { type CaptionStyle, DEFAULT_STYLE, normalizeStyle } from "@/lib/caption-style";
import CaptionEditor from "./caption-editor";
import { btnCls, cardCls, ghostCls, inputCls } from "./ui";

// One ad in production: its clips (with live status), the automatic review, the free automatic redos,
// and the final assembly with captions. Used right after generating and from Videos → an ad.

interface Clip { id: string; idx: number; text: string; status: string; url: string | null; image_url: string | null; error: string | null; model: string }
interface Ad { id: string; title: string | null; format: string | null; aspect: string | null; model: string | null; status: string; final_url: string | null; settings: Record<string, unknown> | null }
interface ReviewRow { clipId: string; idx: number; sim: number; issues: string[]; severe: boolean; look?: string; freeRedo?: boolean }


export default function AdWork({ adId }: { adId: string }) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [err, setErr] = useState("");
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [phase, setPhase] = useState<"" | "review" | "redo" | "build">("");
  const [note, setNote] = useState("");
  const [captionsOn, setCaptionsOn] = useState(true);
  const [capStyle, setCapStyle] = useState<CaptionStyle>(DEFAULT_STYLE);
  // start from the style used last time (per browser)
  useEffect(() => { try { const v = localStorage.getItem("creads-captions"); if (v) setCapStyle(normalizeStyle(JSON.parse(v))); } catch {} }, []);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [models, setModels] = useState<{ id: string; label: string; configured: boolean; silent?: boolean; noFaces?: boolean }[]>([]);
  const [retryModel, setRetryModel] = useState("veo-3.1-fast");
  useEffect(() => { fetch("/api/models").then((r) => r.json()).then((d) => d.video && setModels(d.video)).catch(() => {}); }, []);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const loadAd = useCallback(async () => {
    const r = await fetch(`/api/data/ads/${adId}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error || "No se pudo cargar el anuncio.");
    setAd(d.row);
    if (d.row.settings?.captions) setCapStyle(normalizeStyle(d.row.settings.captions));
    const rv = (d.row.settings?.review ?? null) as ReviewRow[] | null;
    if (rv) setReview(rv);
  }, [adId]);

  const poll = useCallback(async (id: string, tries = 0) => {
    const res = await fetch(`/api/clips/status?id=${id}`);
    const d = await res.json().catch(() => ({}));
    if (d.clip) setClips((cs) => cs.map((c) => (c.id === id ? d.clip : c)));
    if (d.clip?.status === "generating" && tries < 80) timers.current.push(setTimeout(() => poll(id, tries + 1), 12000));
  }, []);

  const loadClips = useCallback(async () => {
    const r = await fetch(`/api/data/clips?ad_id=${adId}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error || "No se pudieron cargar los cortes.");
    setClips(d.rows);
    (d.rows as Clip[]).filter((c) => c.status === "generating").forEach((c, i) => timers.current.push(setTimeout(() => poll(c.id), 1500 + i * 400)));
  }, [adId, poll]);

  useEffect(() => {
    loadAd(); loadClips();
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, [loadAd, loadClips]);

  async function run(id: string, model?: string, free = false) {
    setClips((cs) => cs.map((c) => (c.id === id ? { ...c, status: "starting", error: null } : c)));
    const res = await fetch("/api/clips/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, model, free }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setClips((cs) => cs.map((c) => (c.id === id ? { ...c, status: "failed", error: d.error || "No se pudo iniciar." } : c)));
    setClips((cs) => cs.map((c) => (c.id === id ? d.clip : c)));
    timers.current.push(setTimeout(() => poll(id), 20000));
  }

  async function redo(id: string, problem: string, free = false) {
    if (problem.trim()) {
      setClips((cs) => cs.map((c) => (c.id === id ? { ...c, status: "starting", error: null } : c)));
      const res = await fetch("/api/clips/fix", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, problem }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d.error || "No se pudo corregir el corte."); }
    }
    await run(id, undefined, free);
  }

  async function doReview() {
    setPhase("review"); setErr("");
    const res = await fetch("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ adId }) });
    const d = await res.json().catch(() => ({}));
    setPhase("");
    if (!res.ok) return setErr(d.error || "No se pudo revisar.");
    setReview(d.results);
    if (d.learned) setNote(`Creads aprendió ${d.learned} regla${d.learned === 1 ? "" : "s"} nueva${d.learned === 1 ? "" : "s"} de este video.`);
    // Free automatic redo of severe problems: the server says which clips still have one
    // (max 1 per clip and 2 per ad, counted on the server).
    const todo = (d.results as ReviewRow[]).filter((r) => r.severe && r.freeRedo);
    if (todo.length) {
      setPhase("redo");
      setNote((n) => `${n ? `${n} ` : ""}Rehaciendo ${todo.length} corte${todo.length === 1 ? "" : "s"} con errores graves, sin costo para ti.`);
      await Promise.all(todo.map((r) => redo(r.clipId, r.issues.join(". "), true)));
      setReview(null);
      setPhase("");
      loadAd();
    }
  }

  async function doBuild() {
    setPhase("build"); setErr("");
    const res = await fetch("/api/montage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ adId, captions: captionsOn, style: capStyle }) });
    try { localStorage.setItem("creads-captions", JSON.stringify(capStyle)); } catch {}
    const d = await res.json().catch(() => ({}));
    setPhase("");
    if (!res.ok) return setErr(d.error || "No se pudo armar el anuncio.");
    setAd(d.ad);
  }

  if (!ad) return <div className={cardCls}><p className="text-muted">{err || "Cargando…"}</p></div>;
  const f = formatById(ad.format ?? "ugc");
  const done = clips.filter((c) => c.status === "done").length;
  const all = clips.length > 0 && done === clips.length;
  const busyClips = clips.some((c) => ["generating", "starting", "pending"].includes(c.status));
  const reviewOf = (id: string) => review?.find((r) => r.clipId === id);
  const failed = clips.filter((c) => c.status === "failed");
  const faceRefused = failed.some((c) => /no acepta fotos de personas reales|likeness/i.test(c.error ?? ""));
  const usable = models.filter((m) => m.configured && !m.silent && !(faceRefused && m.noFaces));
  async function retryFailed() {
    for (let i = 0; i < failed.length; i += 2) await Promise.all(failed.slice(i, i + 2).map((c) => run(c.id, retryModel)));
  }
  const ratio = ad.aspect === "16:9" ? "aspect-video" : ad.aspect === "1:1" ? "aspect-square" : ad.aspect === "4:5" ? "aspect-[4/5]" : "aspect-[9/16]";

  return (
    <div className="flex flex-col gap-4">
      <section className={cardCls}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold">{ad.title || "Anuncio"}</h2>
            <p className="text-sm text-muted">{f.icon} {f.name} · {ad.aspect} · {done} de {clips.length} cortes listos</p>
          </div>
          {busyClips && <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-text">Generando… cada corte tarda 1 a 4 min</span>}
        </div>
        {failed.length > 0 && !busyClips && (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm">
            <p className="basis-full">
              {failed.length === 1 ? "1 corte falló." : `${failed.length} cortes fallaron.`}
              {faceRefused ? " El modelo que elegiste no acepta la cara de tu avatar: reintenta con otro modelo." : " Puedes reintentarlos con el mismo modelo o con otro."}
            </p>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Modelo
              <select value={retryModel} onChange={(e) => setRetryModel(e.target.value)} className={inputCls}>
                {usable.map((m) => <option key={m.id} value={m.id}>{m.label.replace(/ \((Gemini API|fal\.ai)\)$/, "")}</option>)}
              </select>
            </label>
            <button type="button" onClick={retryFailed} className={btnCls}>Reintentar {failed.length === 1 ? "el corte" : `los ${failed.length}`} con este modelo</button>
          </div>
        )}
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
          {clips.map((c) => {
            const rv = reviewOf(c.id);
            return (
              <li key={c.id} className="flex flex-col overflow-hidden rounded-xl border border-line">
                <div className={`relative grid place-items-center bg-surface-2 ${ratio}`}>
                  {c.url ? <video src={c.url} controls playsInline className="h-full w-full object-cover" /> : c.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.image_url} alt="" className="h-full w-full object-cover opacity-60" />
                  ) : null}
                  {!c.url && <span className="absolute rounded-full bg-surface px-2 py-1 text-xs font-semibold">{c.status === "failed" ? "Falló" : c.status === "pending" ? "En cola" : "Generando…"}</span>}
                  {rv && c.url && (
                    <span className={`absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-bold ${rv.issues.length ? (rv.severe ? "bg-bad text-white" : "bg-warn text-black") : "bg-good text-white"}`}>
                      {rv.issues.length ? (rv.severe ? "Error grave" : "Detalle") : "OK"}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-2">
                  <span className="font-mono text-xs text-muted">Corte {c.idx + 1}</span>
                  <p className="line-clamp-3 text-xs">“{c.text}”</p>
                  {(rv?.issues.length ? rv.issues.join(" · ") : c.error) && <p className="text-xs text-bad">{rv?.issues.length ? rv.issues.join(" · ") : c.error}</p>}
                  {(c.status === "done" || c.status === "failed") && (
                    <div className="mt-auto flex flex-col gap-1">
                      <input aria-label={`Qué corregir en el corte ${c.idx + 1}`} value={notes[c.id] ?? ""} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })}
                        placeholder="¿Qué corregir? (opcional)" className={`${inputCls} py-1 text-xs`} />
                      <button type="button" onClick={() => redo(c.id, notes[c.id] ?? "")} className="self-start text-xs font-semibold text-accent-text">
                        {c.status === "failed" ? "Reintentar" : "Rehacer este corte"}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={cardCls}>
        <h2 className="font-display text-xl font-bold">Revisar y armar el anuncio</h2>
        {!all ? (
          <p className="text-sm text-muted">Cuando todos los cortes estén listos, Creads los revisa (que digan el guion exacto y que sea la misma persona en todos) y arma el anuncio final con subtítulos.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={doReview} disabled={!!phase} className={ghostCls}>
                {phase === "review" ? "Revisando cada corte… (≈ 1 min)" : phase === "redo" ? "Rehaciendo cortes…" : review ? "Revisar de nuevo" : "1 · Revisar los cortes"}
              </button>
              {review && (
                <span className="text-sm text-muted">
                  {review.filter((r) => r.issues.length).length === 0 ? "Todos los cortes dicen el guion y se ven bien ✓" : `${review.filter((r) => r.issues.length).length} corte(s) con observaciones.`}
                </span>
              )}
            </div>
            {note && <p className="rounded-lg bg-accent/10 p-3 text-sm">{note}</p>}

            <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-4">
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={captionsOn} onChange={(e) => setCaptionsOn(e.target.checked)} /> Subtítulos
              </label>
              {captionsOn && (
                <CaptionEditor value={capStyle} onChange={setCapStyle} aspect={ad.aspect ?? "9:16"}
                  sample={clips[0]?.text || "Así se ven tus subtítulos"} video={clips.find((c) => c.url)?.url} />
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={doBuild} disabled={!!phase} className={btnCls}>
                  {phase === "build" ? "Armando el anuncio… (≈ 1–2 min)" : ad.final_url ? "Volver a armar" : "2 · Armar anuncio"}
                </button>
                {!review && <span className="text-xs text-muted">Puedes armarlo sin revisar, pero la revisión encuentra errores y los arregla gratis.</span>}
              </div>
            </div>
          </>
        )}
        {err && <p className="text-sm text-bad">{err}</p>}
      </section>

      {ad.final_url && (
        <section className={cardCls}>
          <h2 className="font-display text-xl font-bold">Tu anuncio está listo 🎬</h2>
          <div className="grid gap-4 md:grid-cols-[minmax(0,320px)_1fr]">
            <video src={ad.final_url} controls playsInline className={`w-full rounded-xl bg-black ${ratio}`} />
            <div className="flex flex-col gap-2 text-sm">
              <a href={ad.final_url} download target="_blank" rel="noopener noreferrer" className={`${btnCls} self-start`}>Descargar video</a>
              {typeof ad.settings?.srt === "string" && <a href={ad.settings.srt} target="_blank" rel="noopener noreferrer" className="self-start text-accent-text underline">Descargar subtítulos (.srt)</a>}
              <p className="text-muted">Quedó guardado en <Link href="/app/biblioteca" className="underline">Anuncios terminados</Link>.</p>
              <p className="text-xs text-muted">Recuerda: Meta pide marcar los anuncios hechos con IA al publicarlos.</p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
