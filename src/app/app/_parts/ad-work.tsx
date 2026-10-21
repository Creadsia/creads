"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatById } from "@/lib/formats";
import { type CaptionStyle, DEFAULT_STYLE, normalizeStyle } from "@/lib/caption-style";
import { billedSeconds, lipsyncProUsd, lipsyncSeconds, lipsyncUsd } from "@/lib/historias";
import CaptionEditor from "./caption-editor";
import { btnCls, cardCls, ghostCls, inputCls, Working } from "./ui";
import { refreshCredits, useCredits } from "./use-credits";

// One ad in production: its clips (with live status), the automatic review, the free automatic redos,
// and the final assembly with captions. Used right after generating and from Videos → an ad.

interface Clip { id: string; idx: number; text: string; status: string; url: string | null; image_url: string | null; error: string | null; model: string }
interface Ad { id: string; title: string | null; format: string | null; aspect: string | null; model: string | null; status: string; final_url: string | null; settings: Record<string, unknown> | null }
interface VideoModel { id: string; label: string; configured: boolean; silent?: boolean; noFaces?: boolean; usdPerSecond: number; durations?: number[] | null; talking?: boolean }
interface ReviewRow { clipId: string; idx: number; sim: number; issues: string[]; severe: boolean; look?: string; freeRedo?: boolean; url?: string }

// One-tap corrections for a cut: the most common fixes, so nobody has to think of the words.
const QUICK_FIXES = ["Otra toma", "Más natural", "Que mire a la cámara", "Misma persona que en los otros cortes", "Mejor luz", "Sin texto en pantalla", "Que hable más lento", "Que no se corte la frase"];


/**
 * In «Crear anuncio» the same ad is shown one stage at a time: «videos» (the cuts being made), «correcciones»
 * (the automatic review and redoing a cut) and «edicion» (Edición Pro, captions, the final video). Without
 * a view (Videos → an ad) everything shows on one page.
 */
export type AdView = "videos" | "correcciones" | "edicion";

export default function AdWork({ adId, view, onNext }: { adId: string; view?: AdView; onNext?: () => void }) {
  const [ad, setAd] = useState<Ad | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [err, setErr] = useState("");
  const [review, setReview] = useState<ReviewRow[] | null>(null);
  const [phase, setPhase] = useState<"" | "review" | "redo" | "build">("");
  const [note, setNote] = useState("");
  const [captionsOn, setCaptionsOn] = useState(true);
  const [capStyle, setCapStyle] = useState<CaptionStyle>(DEFAULT_STYLE);
  // «Edición Pro» (on by default): animated headlines, zooms, flashes, sounds and a closing card
  const [pro, setPro] = useState(true);
  const [cierre, setCierre] = useState({ titulo: "", linea: "" });
  const [indicaciones, setIndicaciones] = useState("");
  const [estilo, setEstilo] = useState("energico");
  // start from the style used last time (per browser)
  useEffect(() => { try { const v = localStorage.getItem("creads-captions"); if (v) setCapStyle(normalizeStyle(JSON.parse(v))); } catch {} }, []);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [models, setModels] = useState<VideoModel[]>([]);
  const { price } = useCredits();
  // per-clip notes shown under a clip (e.g. a refused redo on a finished clip, a clip taking too long)
  const [clipMsg, setClipMsg] = useState<Record<string, string>>({});
  const say = (id: string, text: string) => setClipMsg((m) => ({ ...m, [id]: text }));
  // paid actions ask first, inline: one clip (its id) or all failed clips ("all")
  const [ask, setAsk] = useState<string | null>(null);
  const [retryModel, setRetryModel] = useState("kling-3.0");
  useEffect(() => { fetch("/api/models").then((r) => r.json()).then((d) => d.video && setModels(d.video)).catch(() => {}); }, []);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // when the cuts being redone finish, the ad is (re)assembled by itself: no extra clicks
  const [autoBuild, setAutoBuild] = useState(false);

  const loadAd = useCallback(async () => {
    const r = await fetch(`/api/data/ads/${adId}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error || "No se pudo cargar el anuncio.");
    setAd(d.row);
    if (d.row.settings?.captions) setCapStyle(normalizeStyle(d.row.settings.captions));
    const rv = (d.row.settings?.review ?? null) as ReviewRow[] | null;
    if (rv) setReview(rv);
  }, [adId]);

  // Follows a clip until it's done or failed. A failed check (network, server busy) just tries again;
  // a clip stuck while starting is cleared by the server after a few minutes (and its credits return).
  const poll = useCallback(async (id: string, tries = 0) => {
    const d = await fetch(`/api/clips/status?id=${id}`).then((r) => r.json()).catch(() => ({}));
    if (d.clip) setClips((cs) => cs.map((c) => (c.id === id ? d.clip : c)));
    const still = !d.clip || ["generating", "starting", "syncing"].includes(d.clip.status);
    if (still && tries < 120) timers.current.push(setTimeout(() => poll(id, tries + 1), 12000));
    else if (still) setClipMsg((m) => ({ ...m, [id]: "Este corte está tardando más de lo normal. Recarga la página para revisarlo." }));
  }, []);

  const loadClips = useCallback(async () => {
    const r = await fetch(`/api/data/clips?ad_id=${adId}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error || "No se pudieron cargar los cortes.");
    setClips(d.rows);
    (d.rows as Clip[]).filter((c) => ["generating", "starting", "syncing"].includes(c.status)).forEach((c, i) => timers.current.push(setTimeout(() => poll(c.id), 1500 + i * 400)));
  }, [adId, poll]);

  useEffect(() => {
    loadAd(); loadClips();
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, [loadAd, loadClips]);

  async function run(id: string, model?: string, free = false, prev?: Clip) {
    const before = prev ?? clips.find((c) => c.id === id);
    setClipMsg((m) => { const n = { ...m }; delete n[id]; return n; });
    setClips((cs) => cs.map((c) => (c.id === id ? { ...c, status: "starting", error: null } : c)));
    const res = await fetch("/api/clips/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, model, free }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : { error: "Se cortó la conexión. Revisa tu internet y vuelve a intentar." };
    if (!res) { timers.current.push(setTimeout(() => poll(id), 5000)); }
    if (!res || !res.ok) {
      const msg = d.error || "No se pudo iniciar.";
      // a finished clip stays finished when the redo is refused (no credits, limit…): only the message shows
      if (before?.status === "done") { setClips((cs) => cs.map((c) => (c.id === id ? before : c))); return say(id, msg); }
      return setClips((cs) => cs.map((c) => (c.id === id ? { ...c, status: "failed", error: msg } : c)));
    }
    setClips((cs) => cs.map((c) => (c.id === id ? d.clip : c)));
    refreshCredits();
    timers.current.push(setTimeout(() => poll(id), 20000));
  }

  async function redo(id: string, problem: string, free = false) {
    const before = clips.find((c) => c.id === id);
    if (!free && ad?.final_url) setAutoBuild(true);
    if (problem.trim()) {
      setClips((cs) => cs.map((c) => (c.id === id ? { ...c, status: "starting", error: null } : c)));
      const res = await fetch("/api/clips/fix", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, problem }) }).catch(() => null);
      if (!res || !res.ok) {
        // don't spend on a redo without the correction the customer asked for
        if (before) setClips((cs) => cs.map((c) => (c.id === id ? before : c)));
        return say(id, "No pudimos aplicar tu corrección. No se usó tu saldo; intenta de nuevo.");
      }
    }
    await run(id, undefined, free, before);
  }

  async function doReview() {
    setPhase("review"); setErr("");
    const res = await fetch("/api/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ adId }) }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setPhase("");
    if (!res || !res.ok) { setAutoBuild(false); return setErr(d.error || "No se pudo revisar. Revisa tu conexión e intenta de nuevo."); }
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
      return;
    }
    // severe problems with no free redo: stop before assembling, so the customer decides (redo a cut or build anyway)
    const severe = (d.results as ReviewRow[]).filter((r) => r.severe).length;
    if (severe) {
      setAutoBuild(false);
      setNote((n) => `${n ? `${n} ` : ""}La revisión encontró errores graves en ${severe} corte${severe === 1 ? "" : "s"} (marcado${severe === 1 ? "" : "s"} abajo). Rehazlo${severe === 1 ? "" : "s"} con una nota de qué cambiar, o arma el anuncio igual.`);
    }
  }

  /** «Revisar y armar»: review; clean → assembled right away; severe problems → stops and shows them. */
  async function reviewAndBuild() {
    setAutoBuild(true);
    await doReview();
  }

  async function doBuild() {
    setAutoBuild(false);
    setPhase("build"); setErr("");
    const res = await fetch("/api/montage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ adId, captions: captionsOn, style: capStyle, pro, cierre, indicaciones, estilo }) }).catch(() => null);
    try { localStorage.setItem("creads-captions", JSON.stringify(capStyle)); } catch {}
    const d = res ? await res.json().catch(() => ({})) : {};
    setPhase("");
    if (!res || !res.ok) return setErr(d.error || "No se pudo armar el anuncio. Revisa tu conexión e intenta de nuevo.");
    setAd(d.ad);
  }

  // all cuts ready and nothing running: assemble now if it was asked for
  const ready = clips.length > 0 && clips.every((c) => c.status === "done");
  const running = clips.some((c) => ["generating", "starting", "syncing"].includes(c.status));
  useEffect(() => {
    if (autoBuild && ready && !running && !phase) {
      setNote((n) => `${n ? `${n} ` : ""}Armando el anuncio con los cortes nuevos…`);
      doBuild();
    }
    // doBuild changes on every render; the trigger is the state above
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoBuild, ready, running, phase]);

  // opening «Correcciones» with every cut ready and no review yet: review right away (free)
  const autoReviewed = useRef(false);
  useEffect(() => {
    if (view === "correcciones" && ready && !running && !review && !phase && !autoReviewed.current) { autoReviewed.current = true; doReview(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, ready, running, review, phase]);

  if (!ad) return <div className={cardCls}><p className="text-muted">{err || "Cargando…"}</p></div>;
  const f = formatById(ad.format ?? "ugc");
  const done = clips.filter((c) => c.status === "done").length;
  const all = clips.length > 0 && done === clips.length;
  const busyClips = clips.some((c) => ["generating", "starting", "syncing"].includes(c.status));
  // never started (the tab closed while starting them, or a start was refused): start them from here
  const waiting = clips.filter((c) => c.status === "pending");
  // a review belongs to the video it looked at: a redone clip has no review yet
  const reviewOf = (id: string) => { const c = clips.find((x) => x.id === id); return review?.find((r) => r.clipId === id && (!r.url || r.url === c?.url)); };
  const failed = clips.filter((c) => c.status === "failed");
  const refused = (c: Clip) => c.status === "failed" && /no acepta fotos de personas reales|likeness/i.test(c.error ?? "");
  const faceRefused = failed.some(refused);
  const usable = models.filter((m) => m.configured && !m.silent && !(faceRefused && m.noFaces));
  async function retryFailed() {
    for (let i = 0; i < failed.length; i += 2) await Promise.all(failed.slice(i, i + 2).map((c) => run(c.id, retryModel)));
  }
  // what one clip costs to generate again: the same rules as the server (api/clips/run). Veo 3.1 and
  // Veo 3.1 Fast take the face/product photos directly and are then always billed 8 s; other models
  // first draw an opening frame from those photos (one image) if the clip has none yet.
  const st = (ad?.settings ?? {}) as { avatar?: { image_url?: string | null } | null; product?: { image_url?: string | null } | null };
  const hasRefs = Boolean(st.avatar?.image_url || st.product?.image_url);
  const clipUsd = (c: Clip, modelId = c.model) => {
    const m = models.find((x) => x.id === modelId);
    if (!m) return 0;
    const words = String(c.text || "").split(/\s+/).filter(Boolean).length;
    // talking avatar: as long as the voice, from the picture already drawn
    if (m.talking) return m.usdPerSecond * Math.min(15, Math.max(3, Math.ceil(words / 2.4 + 0.8)));
    const asked = Math.min(15, Math.max(4, Math.ceil(words / 2.7) + 1));
    const veo = m.id.startsWith("veo");
    const takesRefs = (m.id === "veo-3.1" || m.id === "veo-3.1-fast") && hasRefs;
    const secs = veo ? (takesRefs ? 8 : asked <= 4 ? 4 : asked <= 6 ? 6 : 8) : billedSeconds(asked, m.durations ?? undefined);
    const frame = !takesRefs && hasRefs && !c.image_url ? 0.134 : 0; // Nano Banana Pro opening frame
    const vs = ad.settings as { voiceId?: string | null; lipsync?: string | null } | null;
    const voice = vs?.voiceId ? (vs.lipsync === "pro" ? lipsyncProUsd : lipsyncUsd)(lipsyncSeconds(String(c.text || "")), String(c.text || "")) : 0;
    return m.usdPerSecond * secs + frame + voice;
  };
  const cost = (usd: number) => (usd > 0 ? price(usd) : "segundos según el modelo");
  const retryAllUsd = failed.reduce((t, c) => t + clipUsd(c, retryModel), 0);
  const waitingUsd = waiting.reduce((t, c) => t + clipUsd(c), 0);
  const ratio = ad.aspect === "16:9" ? "aspect-video" : ad.aspect === "1:1" ? "aspect-square" : ad.aspect === "4:5" ? "aspect-[4/5]" : "aspect-[9/16]";

  return (
    <div className="flex flex-col gap-4">
      {view !== "edicion" && <section className={cardCls}>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold">{view === "correcciones" ? "6 · Correcciones" : view === "videos" ? "5 · Videos" : ad.title || "Anuncio"}</h2>
            <p className="text-sm text-muted">{view === "correcciones" ? "Creads revisa cada corte: que diga el guion exacto y que se vea bien. Los errores graves se rehacen gratis; también puedes pedir un cambio en cualquier corte." : `${f.icon} ${f.name} · ${ad.aspect} · ${done} de ${clips.length} cortes listos`}</p>
          </div>
          {busyClips && <Working label="Generando cortes…" className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent-text" />}
        </div>
        {waiting.length > 0 && !busyClips && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/50 bg-warn/10 p-3 text-sm">
            <span>{waiting.length === 1 ? "1 corte quedó sin empezar." : `${waiting.length} cortes quedaron sin empezar.`} Se cobran recién cuando empiezan.</span>
            <button type="button" className={btnCls} onClick={async () => { for (let i = 0; i < waiting.length; i += 2) await Promise.all(waiting.slice(i, i + 2).map((c) => run(c.id))); }}>
              Empezar {waiting.length === 1 ? "el corte" : `los ${waiting.length}`}{waitingUsd > 0 ? ` · ≈ ${price(waitingUsd)}` : ""}
            </button>
          </div>
        )}
        {failed.length > 0 && !busyClips && (
          <div className="flex flex-wrap items-end gap-3 rounded-xl border border-bad/40 bg-bad/10 p-3 text-sm">
            <p className="basis-full">
              {failed.length === 1 ? "1 corte falló." : `${failed.length} cortes fallaron.`}
              {faceRefused ? " El modelo que elegiste no acepta la cara de tu avatar: reintenta con otro modelo." : " Puedes reintentarlos con el mismo modelo o con otro."}
            </p>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">Modelo
              <select value={retryModel} onChange={(e) => setRetryModel(e.target.value)} className={inputCls}>
                {usable.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
            </label>
            {ask === "all" ? (
              <div className="flex basis-full flex-wrap items-center gap-2 rounded-lg bg-surface p-2">
                <span>Reintentar {failed.length === 1 ? "el corte" : `los ${failed.length} cortes`} usa ≈ {cost(retryAllUsd)}. Si alguno vuelve a fallar, esos segundos se devuelven solos.</span>
                <button type="button" onClick={() => { setAsk(null); retryFailed(); }} className={btnCls}>Sí, reintentar</button>
                <button type="button" onClick={() => setAsk(null)} className={ghostCls}>Cancelar</button>
              </div>
            ) : (
              <button type="button" onClick={() => setAsk("all")} className={btnCls}>Reintentar {failed.length === 1 ? "el corte" : `los ${failed.length}`} con este modelo{retryAllUsd > 0 ? ` · ≈ ${price(retryAllUsd)}` : ""}</button>
            )}
          </div>
        )}
        {view === "correcciones" && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={doReview} disabled={!!phase || running || !all} className={ghostCls}>
              {phase === "review" ? "Revisando cada corte… (≈ 1 min)" : phase === "redo" ? "Rehaciendo cortes…" : review ? "Revisar de nuevo" : "Revisar"}
            </button>
            {review && <span className="text-sm text-muted">{review.filter((r) => r.issues.length).length === 0 ? "Todos los cortes dicen el guion y se ven bien ✓" : `${review.filter((r) => r.issues.length).length} corte(s) con observaciones: revísalos abajo.`}</span>}
          </div>
        )}
        {view === "correcciones" && note && <p className="rounded-lg bg-accent/10 p-3 text-sm">{note}</p>}
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
                  {!c.url && <span className="absolute rounded-full bg-surface px-2 py-1 text-xs font-semibold">{c.status === "failed" ? "Falló" : c.status === "pending" ? "En cola" : <Working key={c.id} label="Generando…" />}</span>}
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
                  {clipMsg[c.id] && <p role="status" className="text-xs text-warn">{clipMsg[c.id]}</p>}
                  {(c.status === "failed" || (c.status === "done" && view !== "videos")) && (
                    <div className="mt-auto flex flex-col gap-1">
                      <input aria-label={`Qué corregir en el corte ${c.idx + 1}`} value={notes[c.id] ?? ""} onChange={(e) => setNotes({ ...notes, [c.id]: e.target.value })}
                        placeholder="¿Qué corregir? (opcional)" className={`${inputCls} py-1 text-xs`} />
                      {c.status === "done" && (
                        <div className="flex flex-wrap gap-1" role="group" aria-label={`Correcciones rápidas del corte ${c.idx + 1}`}>
                          {QUICK_FIXES.map((q) => {
                            const cur = notes[c.id] ?? "";
                            const on = cur.split(". ").includes(q);
                            return (
                              <button key={q} type="button" aria-pressed={on}
                                onClick={() => setNotes({ ...notes, [c.id]: on ? cur.split(". ").filter((x) => x !== q).join(". ") : cur.trim() ? `${cur.trim().replace(/\.$/, "")}. ${q}` : q })}
                                className={`rounded-full border px-2 py-0.5 text-[11px] ${on ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink"}`}>{q}</button>
                            );
                          })}
                        </div>
                      )}
                      {ask === c.id ? (
                        <div className="flex flex-col gap-1.5 rounded-lg bg-surface-2 p-2 text-xs">
                          <span>{c.status === "failed" ? "Reintentar" : "Rehacer"} el corte {c.idx + 1}{refused(c) ? ` con ${models.find((m) => m.id === retryModel)?.label ?? "otro modelo"}` : ""} usa ≈ {cost(refused(c) ? clipUsd(c, retryModel) : clipUsd(c))}. Si falla, los segundos vuelven solos.{ad.final_url ? " Cuando esté listo, rearmamos tu anuncio solos." : ""}</span>
                          <div className="flex gap-2">
                            {/* a model that refused the face would refuse again: retry with the one chosen above */}
                            <button type="button" onClick={() => { setAsk(null); if (refused(c)) run(c.id, retryModel); else redo(c.id, notes[c.id] ?? ""); }} className="font-semibold text-accent-text">Sí, {c.status === "failed" ? "reintentar" : "rehacer"}</button>
                            <button type="button" onClick={() => setAsk(null)} className="text-muted">Cancelar</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setAsk(c.id)} className="self-start text-xs font-semibold text-accent-text">
                          {refused(c) ? `Reintentar con ${models.find((m) => m.id === retryModel)?.label ?? "otro modelo"}` : c.status === "failed" ? "Reintentar" : "Rehacer este corte"}{(refused(c) ? clipUsd(c, retryModel) : clipUsd(c)) > 0 ? ` · ≈ ${price(refused(c) ? clipUsd(c, retryModel) : clipUsd(c))}` : ""}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {view && onNext && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={onNext} disabled={!all || running || !!phase} className={btnCls}>{view === "videos" ? "Siguiente: correcciones →" : "Siguiente: edición final →"}</button>
            {!all && <span className="text-sm text-muted">{busyClips ? "Espera a que terminen los cortes." : "Faltan cortes por terminar."}</span>}
          </div>
        )}
      </section>}

      {(!view || view === "edicion") && <section className={cardCls}>
        <h2 className="font-display text-xl font-bold">{view ? "7 · Edición final" : "Revisar y armar el anuncio"}</h2>
        {!all ? (
          <p className="text-sm text-muted">Cuando todos los cortes estén listos, Creads los revisa (que digan el guion exacto y que sea la misma persona en todos) y arma el anuncio final con subtítulos.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={doReview} disabled={!!phase || running} className={ghostCls}>
                {phase === "review" ? "Revisando cada corte… (≈ 1 min)" : phase === "redo" ? "Rehaciendo cortes…" : review ? "Revisar de nuevo" : "Solo revisar"}
              </button>
              {review && (
                <span className="text-sm text-muted">
                  {review.filter((r) => r.issues.length).length === 0 ? "Todos los cortes dicen el guion y se ven bien ✓" : `${review.filter((r) => r.issues.length).length} corte(s) con observaciones.`}
                </span>
              )}
            </div>
            {note && <p className="rounded-lg bg-accent/10 p-3 text-sm">{note}</p>}

            <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-4">
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input type="checkbox" checked={pro} onChange={(e) => setPro(e.target.checked)} /> ✨ Edición Pro
                  <span className="rounded-full bg-[image:var(--grad)] px-2 py-0.5 text-[10px] font-bold text-white">NUEVO</span>
                </label>
                <p className="text-xs text-muted">La IA edita tu anuncio como una agencia: títulos animados en las palabras clave, zoom y destello en cada corte, efectos de sonido y una placa final con tu marca. Sin costo extra.</p>
                {pro && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-xs font-semibold sm:col-span-2">
                      Indicaciones para la edición (recomendado)
                      <textarea value={indicaciones} maxLength={600} rows={3} onChange={(e) => setIndicaciones(e.target.value)} placeholder={"Ej: Marca: Café Lumbre (se escribe así). Producto: café de grano tostado en Chile. Público: oficinistas de 25 a 40. Destacar: envío gratis en Santiago. Evitar: hablar de precios. Cierre: cafelumbre.cl"} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm font-normal" />
                      <span className="font-normal text-muted">Cuéntale a la IA tu marca, qué quieres destacar y qué evitar. Así los títulos salen bien escritos y en tu tono.</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2" role="radiogroup" aria-label="Estilo de edición">
                      <span className="text-xs font-semibold">Estilo:</span>
                      {([["energico", "Enérgico"], ["elegante", "Elegante"], ["directo", "Directo"]] as const).map(([v, l]) => (
                        <button key={v} type="button" role="radio" aria-checked={estilo === v} onClick={() => setEstilo(v)} className={`rounded-full border px-3 py-1 text-xs ${estilo === v ? "border-transparent bg-[image:var(--grad)] text-white" : "border-line"}`}>{l}</button>
                      ))}
                    </div>
                    <input value={cierre.titulo} maxLength={28} onChange={(e) => setCierre({ ...cierre, titulo: e.target.value })} placeholder="Placa final: tu marca o web (opcional)" aria-label="Título de la placa final" className="rounded-lg border border-line bg-bg px-3 py-2 text-sm" />
                    <input value={cierre.linea} maxLength={48} onChange={(e) => setCierre({ ...cierre, linea: e.target.value })} placeholder="Frase final, ej: Pide el tuyo hoy (opcional)" aria-label="Frase de la placa final" className="rounded-lg border border-line bg-bg px-3 py-2 text-sm" />
                    <span className="text-xs text-muted sm:col-span-2">Si los dejas vacíos, la IA los saca de tu guion.</span>
                  </div>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={captionsOn} onChange={(e) => setCaptionsOn(e.target.checked)} /> Subtítulos
              </label>
              {captionsOn && (
                <CaptionEditor value={capStyle} onChange={setCapStyle} aspect={ad.aspect ?? "9:16"}
                  sample={clips[0]?.text || "Así se ven tus subtítulos"} video={clips.find((c) => c.url)?.url} />
              )}
              <div className="flex flex-wrap items-center gap-3">
                {!review && !ad.final_url ? (
                  <>
                    <button type="button" onClick={reviewAndBuild} disabled={!!phase || running || autoBuild} className={btnCls}>
                      {phase === "build" ? (pro ? "Editando en Pro… (≈ 2–3 min)" : "Armando el anuncio… (≈ 1–2 min)") : phase || autoBuild ? "Revisando y editando…" : pro ? "✨ Revisar y hacer Edición Pro" : "Revisar y armar el anuncio"}
                    </button>
                    <button type="button" onClick={doBuild} disabled={!!phase || running} className="text-sm text-muted underline">Armar sin revisar</button>
                    <span className="basis-full text-xs text-muted">La revisión marca los cortes con errores graves antes de armar; si no hay, se arma solo. Todo en un paso.</span>
                  </>
                ) : (
                  <button type="button" onClick={doBuild} disabled={!!phase || running} className={btnCls}>
                    {phase === "build" ? (pro ? "Editando en Pro… (≈ 2–3 min)" : "Armando el anuncio… (≈ 1–2 min)") : ad.final_url ? (pro ? "✨ Volver a editar en Pro" : "Volver a armar") : pro ? "✨ Edición Pro" : "Armar anuncio"}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
        {err && <p className="text-sm text-bad">{err}</p>}
      </section>}

      {ad.final_url && (!view || view === "edicion") && (
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
