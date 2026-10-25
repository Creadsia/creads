"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { btnCls, dl, ghostCls, inputCls, uploadFile, Working } from "../../_parts/ui";
import { ANIMACIONES, FORMATOS, FUENTES, type Corte, type Formato, type Proyecto, type Texto } from "@/lib/editor-tipos";
import type { Word } from "@/lib/textmatch";

// «Editor de video» (owner, 25 Oct 2026: «lo más pro que se pueda»): a finished ad, re-cut in the browser from
// its own clips. Timeline of cuts (order, trims, duplicate, delete), texts on top (drag them on the video),
// subtitles, voice and music volumes, and the format. Undo/redo and autosave. Export renders it once (free).

interface Clip { id: string; idx: number; texto: string; url: string; palabras: Word[] }
interface Datos { titulo: string; aspecto: string; final: string | null; cortes: Clip[]; proyecto: Proyecto | null; musica: string | null }

const COLORES = ["#FFFFFF", "#000000", "#FFE600", "#FF2BD6", "#19E3FF", "#22C55E", "#EF4444", "#FF8A00"];
const len = (c: Corte) => Math.max(0.3, c.b - c.a);
const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
const ratio: Record<Formato, string> = { "9:16": "aspect-[9/16]", "4:5": "aspect-[4/5]", "1:1": "aspect-square" };

export default function Editor({ id }: { id: string }) {
  const [d, setD] = useState<Datos | null>(null);
  const [err, setErr] = useState("");
  const [p, setP] = useState<Proyecto | null>(null);
  const hist = useRef<{ past: Proyecto[]; future: Proyecto[] }>({ past: [], future: [] });
  const [durs, setDurs] = useState<Record<string, number>>({});
  const [sel, setSel] = useState<{ tipo: "corte" | "texto"; i: number } | null>(null);
  const [tab, setTab] = useState<"cortes" | "textos" | "audio" | "formato">("cortes");
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [guardado, setGuardado] = useState<"" | "guardando" | "ok">("");
  const [exp, setExp] = useState<{ busy: boolean; since?: number; url?: string; error?: string }>({ busy: false });
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const cur = useRef(0); // the cut being played
  const [musicaUrl, setMusicaUrl] = useState<string | null>(null);

  // ---------------------------------------------------------------- load
  useEffect(() => {
    fetch(`/api/ads/${id}/editor`).then(async (r) => {
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || "No se pudo abrir el editor.");
      setD(x);
      setMusicaUrl(x.musica);
      setP(x.proyecto ?? { cortes: x.cortes.map((c: Clip) => ({ clipId: c.id, a: 0, b: 600 })), textos: [], subtitulos: true, musica: null, vozVol: 100, formato: (FORMATOS as readonly string[]).includes(x.aspecto) ? x.aspecto : "9:16" });
    }).catch((e) => setErr(e.message));
  }, [id]);
  // each clip's real length (from the file), so trims start right
  useEffect(() => {
    if (!d) return;
    for (const c of d.cortes) {
      const v = document.createElement("video");
      v.preload = "metadata"; v.src = c.url;
      v.onloadedmetadata = () => setDurs((m) => ({ ...m, [c.id]: v.duration }));
    }
  }, [d]);
  useEffect(() => {
    if (!p || !Object.keys(durs).length) return;
    if (p.cortes.some((c) => durs[c.clipId] && c.b > durs[c.clipId])) setP({ ...p, cortes: p.cortes.map((c) => (durs[c.clipId] && c.b > durs[c.clipId] ? { ...c, b: durs[c.clipId] } : c)) });
  }, [durs, p]);

  // ---------------------------------------------------------------- edits, undo, autosave
  const cambiar = useCallback((fn: (x: Proyecto) => Proyecto) => {
    setP((x) => { if (!x) return x; hist.current.past.push(x); hist.current.past = hist.current.past.slice(-60); hist.current.future = []; return fn(x); });
  }, []);
  const deshacer = () => setP((x) => { const prev = hist.current.past.pop(); if (!prev || !x) return x; hist.current.future.push(x); return prev; });
  const rehacer = () => setP((x) => { const next = hist.current.future.pop(); if (!next || !x) return x; hist.current.past.push(x); return next; });
  const firstSave = useRef(true);
  useEffect(() => {
    if (!p) return;
    if (firstSave.current) { firstSave.current = false; return; }
    setGuardado("guardando");
    const h = setTimeout(() => {
      fetch(`/api/ads/${id}/editor`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ proyecto: p }) }).then(() => setGuardado("ok")).catch(() => setGuardado(""));
    }, 900);
    return () => clearTimeout(h);
  }, [p, id]);

  // ---------------------------------------------------------------- timeline maths
  const starts = useMemo(() => { const out: number[] = []; let acc = 0; for (const c of p?.cortes ?? []) { out.push(acc); acc += len(c); } return out; }, [p]);
  const total = useMemo(() => (p ? p.cortes.reduce((a, c) => a + len(c), 0) : 0), [p]);
  const clipOf = (cid: string) => d?.cortes.find((c) => c.id === cid);

  // the subtitle words on the edited timeline (preview)
  const palabras = useMemo(() => {
    if (!p || !d) return [] as Word[];
    const out: Word[] = [];
    p.cortes.forEach((c, i) => { for (const w of clipOf(c.clipId)?.palabras ?? []) if (w.s >= c.a - 0.05 && w.e <= c.b + 0.3) out.push({ w: w.w, s: Math.max(0, w.s - c.a) + starts[i], e: Math.max(0, Math.min(w.e, c.b) - c.a) + starts[i] }); });
    return out;
  }, [p, d, starts]); // eslint-disable-line react-hooks/exhaustive-deps
  const frase = useMemo(() => {
    const i = palabras.findIndex((w) => w.s <= t && t < w.e + 0.15);
    if (i < 0) return "";
    const a = Math.floor(i / 4) * 4;
    return palabras.slice(a, a + 4).map((w) => w.w).join(" ");
  }, [palabras, t]);

  // ---------------------------------------------------------------- playback (one <video>, cut after cut)
  const cargar = useCallback((i: number, at = 0, play = false) => {
    const v = video.current; if (!v || !p || !d || !p.cortes[i]) return;
    cur.current = i;
    const c = p.cortes[i], src = clipOf(c.clipId)?.url ?? "";
    const go = () => { v.currentTime = c.a + at; v.volume = Math.min(1, p.vozVol / 100); if (play) v.play().catch(() => setPlaying(false)); };
    if (v.src !== src) { v.src = src; v.onloadeddata = () => { v.onloadeddata = null; go(); }; v.load(); } else go();
  }, [p, d]); // eslint-disable-line react-hooks/exhaustive-deps
  const buscar = useCallback((tt: number, play = playing) => {
    if (!p) return;
    const x = Math.max(0, Math.min(total - 0.01, tt));
    let i = starts.findIndex((s, k) => x >= s && x < s + len(p.cortes[k]));
    if (i < 0) i = 0;
    setT(x); cargar(i, x - starts[i], play);
    const a = audio.current; if (a && a.duration) a.currentTime = x % a.duration;
  }, [p, starts, total, cargar, playing]);
  useEffect(() => { if (p && d) buscar(Math.min(t, total), false); }, [p?.cortes, d]); // eslint-disable-line react-hooks/exhaustive-deps
  function onTime() {
    const v = video.current; if (!v || !p) return;
    const c = p.cortes[cur.current]; if (!c) return;
    if (v.currentTime >= c.b - 0.03) {
      if (cur.current + 1 < p.cortes.length) cargar(cur.current + 1, 0, playing);
      else { v.pause(); audio.current?.pause(); setPlaying(false); setT(total); }
      return;
    }
    setT(starts[cur.current] + Math.max(0, v.currentTime - c.a));
  }
  function playPause() {
    const v = video.current; if (!v) return;
    if (playing) { v.pause(); audio.current?.pause(); setPlaying(false); return; }
    if (t >= total - 0.05) buscar(0, true); else v.play().catch(() => null);
    if (audio.current && p?.musica) { audio.current.volume = (p.musica.vol ?? 25) / 100; audio.current.play().catch(() => null); }
    setPlaying(true);
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.code === "Space") { e.preventDefault(); playPause(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); }
      if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); borrarSel(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- actions
  function borrarSel() {
    if (!sel || !p) return;
    if (sel.tipo === "corte" && p.cortes.length > 1) cambiar((x) => ({ ...x, cortes: x.cortes.filter((_, k) => k !== sel.i) }));
    if (sel.tipo === "texto") cambiar((x) => ({ ...x, textos: x.textos.filter((_, k) => k !== sel.i) }));
    setSel(null);
  }
  const mover = (i: number, dir: -1 | 1) => cambiar((x) => { const c = [...x.cortes]; const j = i + dir; if (j < 0 || j >= c.length) return x; [c[i], c[j]] = [c[j], c[i]]; setSel({ tipo: "corte", i: j }); return { ...x, cortes: c }; });
  const duplicar = (i: number) => cambiar((x) => ({ ...x, cortes: [...x.cortes.slice(0, i + 1), { ...x.cortes[i] }, ...x.cortes.slice(i + 1)] }));
  const dividir = () => {
    if (!p) return;
    const i = cur.current, c = p.cortes[i], at = c.a + (t - starts[i]);
    if (at - c.a < 0.4 || c.b - at < 0.4) return;
    cambiar((x) => ({ ...x, cortes: [...x.cortes.slice(0, i), { ...c, b: at }, { ...c, a: at }, ...x.cortes.slice(i + 1)] }));
  };
  const setCorte = (i: number, patch: Partial<Corte>) => cambiar((x) => ({ ...x, cortes: x.cortes.map((c, k) => (k === i ? { ...c, ...patch } : c)) }));
  const nuevoTexto = () => {
    const tx: Texto = { id: `t${Date.now().toString(36)}`, texto: "Escribe tu texto", desde: Math.min(t, Math.max(0, total - 1)), hasta: Math.min(total, t + 2.5), x: 50, y: 22, tam: 8, color: "#FFFFFF", fondo: "#000000", fuente: "Montserrat ExtraBold", animacion: "pop" };
    cambiar((x) => ({ ...x, textos: [...x.textos, tx] }));
    setSel({ tipo: "texto", i: p?.textos.length ?? 0 }); setTab("textos");
  };
  const setTexto = (i: number, patch: Partial<Texto>, grabar = true) => (grabar ? cambiar : (fn: (x: Proyecto) => Proyecto) => setP((x) => (x ? fn(x) : x)))((x) => ({ ...x, textos: x.textos.map((tx, k) => (k === i ? { ...tx, ...patch } : tx)) }));
  // drag a text on the video
  function arrastrar(i: number, e: React.PointerEvent) {
    const box = frame.current?.getBoundingClientRect(); if (!box) return;
    e.preventDefault(); setSel({ tipo: "texto", i }); setTab("textos");
    const start = p!; hist.current.past.push(start); hist.current.future = [];
    const move = (ev: PointerEvent) => setTexto(i, { x: Math.round(Math.min(95, Math.max(5, ((ev.clientX - box.left) / box.width) * 100))), y: Math.round(Math.min(95, Math.max(5, ((ev.clientY - box.top) / box.height) * 100))) }, false);
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  async function subirMusica(f: File | undefined) {
    if (!f) return;
    try {
      const url = await uploadFile(f);
      setMusicaUrl(url);
      cambiar((x) => ({ ...x, musica: { url, nombre: f.name.replace(/\.[^.]+$/, "").slice(0, 60), vol: 25 } }));
    } catch (e) { alert(e instanceof Error ? e.message : "No se pudo subir la música."); }
  }
  async function exportar() {
    if (!p) return;
    setExp({ busy: true, since: Date.now() });
    const r = await fetch(`/api/ads/${id}/editor/exportar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proyecto: p }) }).catch(() => null);
    const x = r ? await r.json().catch(() => ({})) : {};
    setExp(r?.ok ? { busy: false, url: x.url } : { busy: false, error: x.error || "No se pudo exportar. Intenta de nuevo." });
  }

  // ---------------------------------------------------------------- view
  if (err) return <div className="flex flex-col gap-3 p-4"><p className="text-bad">{err}</p><Link href="/app/videos" className="underline">Volver a mis anuncios</Link></div>;
  if (!d || !p) return <p className="p-4 text-muted">Abriendo el editor…</p>;
  const selC = sel?.tipo === "corte" ? p.cortes[sel.i] : null;
  const selT = sel?.tipo === "texto" ? p.textos[sel.i] : null;
  const px = (s: number) => `${(s / Math.max(total, 0.1)) * 100}%`;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <Link href="/app/videos" className="text-xs font-semibold text-muted hover:text-ink">← Mis anuncios</Link>
          <h1 className="truncate font-display text-xl font-semibold sm:text-2xl">Editor · {d.titulo}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted" aria-live="polite">{guardado === "guardando" ? "Guardando…" : guardado === "ok" ? "✓ Guardado" : ""}</span>
          <button type="button" onClick={deshacer} disabled={!hist.current.past.length} className={ghostCls} title="Deshacer (Ctrl+Z)">↶</button>
          <button type="button" onClick={rehacer} disabled={!hist.current.future.length} className={ghostCls} title="Rehacer (Ctrl+Shift+Z)">↷</button>
          <button type="button" onClick={exportar} disabled={exp.busy} className={btnCls}>{exp.busy ? <Working since={exp.since} label="Exportando…" /> : "Exportar video"}</button>
        </div>
      </header>
      {exp.url && <div className="flex flex-wrap items-center gap-3 rounded-xl border border-good/40 bg-good/10 p-3 text-sm"><b>✓ Listo: tu video editado quedó en Mis anuncios.</b><a href={dl(exp.url)} target="_blank" rel="noreferrer" className="font-semibold underline">Descargar</a></div>}
      {exp.error && <p role="alert" className="text-sm text-bad">{exp.error}</p>}

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* preview */}
        <div className="flex flex-col items-center gap-2">
          <div ref={frame} className={`relative w-full max-w-[340px] overflow-hidden rounded-2xl bg-black ${ratio[p.formato]}`}>
            <video ref={video} playsInline onTimeUpdate={onTime} onClick={playPause} className="absolute inset-0 h-full w-full object-cover" />
            {p.subtitulos && frase && <span className="pointer-events-none absolute inset-x-[8%] bottom-[22%] text-center text-[clamp(14px,4.4vw,22px)] font-extrabold uppercase leading-tight text-white [text-shadow:0_2px_0_#000,0_-2px_0_#000,2px_0_0_#000,-2px_0_0_#000]">{frase}</span>}
            {p.textos.map((tx, i) => (t >= tx.desde && t < tx.hasta) || sel?.tipo === "texto" && sel.i === i ? (
              <span key={tx.id} onPointerDown={(e) => arrastrar(i, e)} style={{ left: `${tx.x}%`, top: `${tx.y}%`, color: tx.color, background: tx.fondo ?? "transparent", fontFamily: `"${tx.fuente}", var(--font-display), sans-serif`, fontSize: `calc(${tx.tam / 100} * min(340px, 100%) )` }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move whitespace-pre-wrap rounded-md px-[0.3em] py-[0.1em] text-center font-black leading-tight touch-none ${tx.fondo ? "" : "[text-shadow:0_2px_4px_rgba(0,0,0,.8)]"} ${sel?.tipo === "texto" && sel.i === i ? "outline outline-2 outline-[#19E3FF]" : ""} ${!(t >= tx.desde && t < tx.hasta) ? "opacity-40" : ""}`}>{tx.texto}</span>
            ) : null)}
          </div>
          {musicaUrl && <audio ref={audio} src={musicaUrl} loop preload="auto" />}
          <div className="flex w-full max-w-[340px] items-center gap-2">
            <button type="button" onClick={playPause} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-bg" aria-label={playing ? "Pausar" : "Reproducir"}>{playing ? "❚❚" : "▶"}</button>
            <span className="font-mono text-xs tabular-nums text-muted">{fmt(t)} / {fmt(total)}</span>
            <button type="button" onClick={dividir} className="ml-auto rounded-lg border border-line px-2.5 py-1.5 text-xs font-semibold hover:border-ink" title="Corta el clip en el punto donde estás">✂ Dividir aquí</button>
          </div>
        </div>

        {/* panels */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="scroll-row flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1 text-sm font-semibold" role="tablist">
            {([["cortes", "Cortes"], ["textos", "Textos"], ["audio", "Audio y subtítulos"], ["formato", "Formato"]] as const).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`whitespace-nowrap rounded-lg px-3 py-2 ${tab === k ? "bg-surface text-ink shadow" : "text-muted"}`}>{l}</button>
            ))}
          </div>

          {tab === "cortes" && (
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
              {selC && sel ? (
                <>
                  <b>Corte {sel.i + 1} · {len(selC).toFixed(1)} s</b>
                  <p className="text-muted">{clipOf(selC.clipId)?.texto || "—"}</p>
                  {(["a", "b"] as const).map((k) => (
                    <label key={k} className="flex flex-col gap-1">
                      <span className="flex justify-between"><span>{k === "a" ? "Empieza en" : "Termina en"}</span><span className="tabular-nums text-muted">{selC[k].toFixed(2)} s</span></span>
                      <input type="range" min={0} max={durs[selC.clipId] ?? Math.max(selC.b, 10)} step={0.05} value={selC[k]}
                        onChange={(e) => { const v = Number(e.target.value); setCorte(sel.i, k === "a" ? { a: Math.min(v, selC.b - 0.3) } : { b: Math.max(v, selC.a + 0.3) }); }} />
                    </label>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={ghostCls} onClick={() => mover(sel.i, -1)} disabled={sel.i === 0}>← Antes</button>
                    <button type="button" className={ghostCls} onClick={() => mover(sel.i, 1)} disabled={sel.i === p.cortes.length - 1}>Después →</button>
                    <button type="button" className={ghostCls} onClick={() => duplicar(sel.i)}>Duplicar</button>
                    <button type="button" className={ghostCls} onClick={borrarSel} disabled={p.cortes.length < 2}>Quitar</button>
                  </div>
                </>
              ) : <p className="text-muted">Toca un corte en la línea de tiempo para recortarlo, moverlo, duplicarlo o quitarlo. «Dividir aquí» lo corta en el punto donde está el video.</p>}
              <div className="flex flex-col gap-1 border-t border-line pt-3">
                <span className="text-xs font-semibold text-muted">Agregar un corte del anuncio</span>
                <div className="flex flex-wrap gap-2">
                  {d.cortes.map((c) => <button key={c.id} type="button" className="rounded-lg border border-line px-2.5 py-1.5 text-xs hover:border-ink" onClick={() => cambiar((x) => ({ ...x, cortes: [...x.cortes, { clipId: c.id, a: 0, b: durs[c.id] ?? 8 }] }))}>+ Corte {c.idx + 1}</button>)}
                </div>
              </div>
            </div>
          )}

          {tab === "textos" && (
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
              <button type="button" onClick={nuevoTexto} className={`${btnCls} self-start`}>+ Agregar texto aquí ({fmt(t)})</button>
              {selT && sel ? (
                <>
                  <textarea className={inputCls} rows={2} value={selT.texto} onChange={(e) => setTexto(sel.i, { texto: e.target.value })} aria-label="Texto" />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex flex-col gap-1">Aparece (s)<input className={inputCls} type="number" step={0.1} min={0} max={total} value={selT.desde} onChange={(e) => setTexto(sel.i, { desde: Number(e.target.value) })} /></label>
                    <label className="flex flex-col gap-1">Se va (s)<input className={inputCls} type="number" step={0.1} min={0} max={total} value={selT.hasta} onChange={(e) => setTexto(sel.i, { hasta: Number(e.target.value) })} /></label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="rounded-lg border border-line px-2.5 py-1.5 text-xs" onClick={() => setTexto(sel.i, { desde: t })}>Aparece ahora</button>
                    <button type="button" className="rounded-lg border border-line px-2.5 py-1.5 text-xs" onClick={() => setTexto(sel.i, { hasta: t })}>Se va ahora</button>
                    <button type="button" className="rounded-lg border border-line px-2.5 py-1.5 text-xs" onClick={() => setTexto(sel.i, { desde: 0, hasta: total })}>Todo el video</button>
                  </div>
                  <label className="flex flex-col gap-1">Letra
                    <select className={inputCls} value={selT.fuente} onChange={(e) => setTexto(sel.i, { fuente: e.target.value as Texto["fuente"] })}>{FUENTES.map((f) => <option key={f}>{f}</option>)}</select>
                  </label>
                  <label className="flex flex-col gap-1">Tamaño<input type="range" min={3} max={16} step={0.5} value={selT.tam} onChange={(e) => setTexto(sel.i, { tam: Number(e.target.value) })} /></label>
                  <div className="flex flex-col gap-1"><span>Color</span><div className="flex flex-wrap gap-1.5">{COLORES.map((c) => <button key={c} type="button" aria-label={c} onClick={() => setTexto(sel.i, { color: c })} className={`h-7 w-7 rounded-full border-2 ${selT.color === c ? "border-[#19E3FF]" : "border-line"}`} style={{ background: c }} />)}</div></div>
                  <div className="flex flex-col gap-1"><span>Fondo</span><div className="flex flex-wrap gap-1.5">
                    <button type="button" onClick={() => setTexto(sel.i, { fondo: null })} className={`h-7 rounded-full border-2 px-2 text-xs ${selT.fondo === null ? "border-[#19E3FF]" : "border-line"}`}>Sin</button>
                    {COLORES.map((c) => <button key={c} type="button" aria-label={`Fondo ${c}`} onClick={() => setTexto(sel.i, { fondo: c })} className={`h-7 w-7 rounded-md border-2 ${selT.fondo === c ? "border-[#19E3FF]" : "border-line"}`} style={{ background: c }} />)}
                  </div></div>
                  <label className="flex flex-col gap-1">Entrada
                    <select className={inputCls} value={selT.animacion} onChange={(e) => setTexto(sel.i, { animacion: e.target.value as Texto["animacion"] })}>{ANIMACIONES.map((a) => <option key={a} value={a}>{{ ninguna: "Sin animación", aparecer: "Aparecer suave", pop: "Pop (rebote)", subir: "Subir" }[a]}</option>)}</select>
                  </label>
                  <p className="text-xs text-muted">Arrastra el texto sobre el video para moverlo.</p>
                  <button type="button" className={`${ghostCls} self-start`} onClick={borrarSel}>Quitar este texto</button>
                </>
              ) : <p className="text-muted">Títulos, precios, llamados a la acción… Agrega un texto en el segundo donde estás y arrástralo sobre el video.</p>}
            </div>
          )}

          {tab === "audio" && (
            <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={p.subtitulos} onChange={(e) => cambiar((x) => ({ ...x, subtitulos: e.target.checked }))} /> Subtítulos (con el estilo de tu anuncio)</label>
              <label className="flex flex-col gap-1"><span className="flex justify-between">Volumen de la voz<span className="text-muted">{p.vozVol}%</span></span><input type="range" min={0} max={150} value={p.vozVol} onChange={(e) => cambiar((x) => ({ ...x, vozVol: Number(e.target.value) }))} /></label>
              <div className="flex flex-col gap-2 border-t border-line pt-3">
                <b>Música de fondo</b>
                {p.musica ? (
                  <>
                    <span className="text-muted">🎵 {p.musica.nombre}</span>
                    <label className="flex flex-col gap-1"><span className="flex justify-between">Volumen de la música<span className="text-muted">{p.musica.vol}%</span></span><input type="range" min={0} max={100} value={p.musica.vol} onChange={(e) => { const vol = Number(e.target.value); if (audio.current) audio.current.volume = vol / 100; cambiar((x) => ({ ...x, musica: x.musica ? { ...x.musica, vol } : null })); }} /></label>
                    <button type="button" className={`${ghostCls} self-start`} onClick={() => { cambiar((x) => ({ ...x, musica: null })); setMusicaUrl(null); }}>Quitar música</button>
                  </>
                ) : <p className="text-muted">Sube tu música (MP3, M4A o WAV). Se repite si es más corta y baja al final. Usa música que tengas derecho a usar.</p>}
                <label className={`${ghostCls} w-fit cursor-pointer`}>{p.musica ? "Cambiar música" : "Subir música"}<input type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/aac" className="sr-only" onChange={(e) => subirMusica(e.target.files?.[0])} /></label>
              </div>
            </div>
          )}

          {tab === "formato" && (
            <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
              <b>Formato del video</b>
              <div className="flex flex-wrap gap-2">
                {FORMATOS.map((f) => <button key={f} type="button" onClick={() => cambiar((x) => ({ ...x, formato: f }))} className={`rounded-xl border-2 px-4 py-2 font-semibold ${p.formato === f ? "border-[#19E3FF]" : "border-line"}`}>{f}<span className="block text-xs font-normal text-muted">{f === "9:16" ? "Stories y Reels" : f === "4:5" ? "Feed" : "Cuadrado"}</span></button>)}
              </div>
              <p className="text-muted">Para tener los dos, exporta en 9:16, cambia a 4:5 y exporta de nuevo: cada exportación queda en tus anuncios.</p>
            </div>
          )}
        </div>
      </div>

      {/* timeline */}
      <section className="flex min-w-0 flex-col gap-2 rounded-2xl border border-line bg-surface p-3" aria-label="Línea de tiempo">
        <div className="relative h-5 cursor-pointer" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); buscar(((e.clientX - r.left) / r.width) * total); }}>
          {Array.from({ length: Math.floor(total) + 1 }, (_, s) => <span key={s} className="absolute top-0 h-2 w-px bg-line" style={{ left: px(s) }}>{s % 5 === 0 && <span className="absolute top-2 -translate-x-1/2 text-[10px] text-muted">{s}s</span>}</span>)}
        </div>
        <div className="relative flex h-14 gap-0.5" onClick={(e) => { if (e.target !== e.currentTarget) return; const r = e.currentTarget.getBoundingClientRect(); buscar(((e.clientX - r.left) / r.width) * total); }}>
          {p.cortes.map((c, i) => (
            <button key={i} type="button" onClick={() => { setSel({ tipo: "corte", i }); setTab("cortes"); buscar(starts[i] + 0.01); }} style={{ width: px(len(c)) }}
              className={`relative min-w-[18px] overflow-hidden rounded-md border-2 bg-surface-2 text-left text-[10px] ${sel?.tipo === "corte" && sel.i === i ? "border-[#19E3FF]" : "border-transparent"}`}>
              <span className="absolute inset-0 opacity-60" style={{ background: `linear-gradient(135deg, hsl(${(clipOf(c.clipId)?.idx ?? 0) * 47 % 360} 70% 45%), transparent)` }} />
              <span className="relative block truncate px-1 pt-1 font-semibold text-ink">C{(clipOf(c.clipId)?.idx ?? 0) + 1} · {len(c).toFixed(1)}s</span>
            </button>
          ))}
          <span className="pointer-events-none absolute top-[-24px] bottom-0 w-0.5 bg-[#FF2BD6]" style={{ left: px(t) }} />
        </div>
        <div className="relative h-8">
          {p.textos.map((tx, i) => (
            <button key={tx.id} type="button" onClick={() => { setSel({ tipo: "texto", i }); setTab("textos"); buscar(tx.desde + 0.01); }} style={{ left: px(tx.desde), width: px(Math.max(0.2, tx.hasta - tx.desde)) }}
              className={`absolute top-0 h-7 min-w-[14px] truncate rounded-md px-1 text-left text-[10px] font-semibold text-black ${sel?.tipo === "texto" && sel.i === i ? "ring-2 ring-[#19E3FF]" : ""}`} title={tx.texto}>
              <span className="absolute inset-0 rounded-md bg-[#FFE600]" /><span className="relative">T · {tx.texto}</span>
            </button>
          ))}
          {!p.textos.length && <span className="text-xs text-muted">Pista de textos: agrega uno en la pestaña «Textos».</span>}
        </div>
        <p className="text-[11px] text-muted">Espacio: reproducir/pausar · Ctrl+Z: deshacer · Supr: quitar lo seleccionado.</p>
      </section>
    </div>
  );
}
