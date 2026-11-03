"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { dl, uploadFile, Working } from "../../_parts/ui";
import { FORMATOS, clampVelocidad, type Corte, type Proyecto, type Texto } from "@/lib/editor-tipos";
import { type CaptionStyle, normalizeStyle } from "@/lib/caption-style";
import type { Word } from "@/lib/textmatch";
import { type Clip, type Datos, type Ed, type Frase, Icon, IconBtn, RATIO, SELECT, type Sel, type Strip, type SubWord, SubtituloLinea, TOOLS, type Tool, ToolBtn, fmt, len } from "./piezas";
import { Panel } from "./paneles";
import Timeline from "./timeline";

// «Editor de video» (owner, 25 Oct 2026: «lo más pro que se pueda»; redesigned the same week to look and work
// like VEED / CapCut: «el estilo del editor es filete, se puede trabajar fácil»). A finished ad, re-cut in the
// browser from its own clips: a multi-track timeline (cuts with frames, trims, drag to reorder; texts over time;
// subtitles; music), texts dragged on the preview, voice and music volumes, the format. Undo/redo, autosave,
// and export renders it once (free). Desktop: tool rail + panel, big preview, timeline below. Phone: preview on
// top, the playhead fixed in the middle of the timeline, tools in a bottom bar that opens a sheet.

export type { Datos } from "./piezas";

/** The frames of a clip for the timeline, read once in the browser (falls back to a live frame if blocked). */
function tira(url: string): Promise<Strip> {
  return new Promise((ok, no) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous"; v.muted = true; v.preload = "auto"; v.playsInline = true;
    const cv = document.createElement("canvas");
    const frames: string[] = [];
    let step = 1, n = 0, k = 0;
    const stop = setTimeout(() => no(new Error("timeout")), 25000);
    const done = (e?: unknown) => { clearTimeout(stop); v.removeAttribute("src"); v.load(); if (e) no(e); else ok({ step, frames, ar: cv.width / cv.height }); };
    v.onerror = () => done(new Error("load"));
    v.onloadeddata = () => {
      const dur = v.duration || 1;
      n = Math.min(16, Math.max(2, Math.ceil(dur)));
      step = dur / n;
      cv.height = 112; cv.width = Math.round(112 * ((v.videoWidth / v.videoHeight) || 9 / 16));
      v.currentTime = 0.05;
    };
    v.onseeked = () => {
      try { cv.getContext("2d")!.drawImage(v, 0, 0, cv.width, cv.height); frames.push(cv.toDataURL("image/jpeg", 0.6)); } catch (e) { done(e); return; }
      k++;
      if (k >= n) { done(); return; }
      v.currentTime = Math.min(v.duration - 0.05, k * step + 0.05);
    };
    v.src = url;
  });
}

const CSS = `
@keyframes edPop{0%{transform:scale(.7)}60%{transform:scale(1.08)}100%{transform:scale(1)}}
@keyframes edFade{from{opacity:0}to{opacity:1}}
@keyframes edUp{from{transform:translateY(35%);opacity:0}to{transform:none;opacity:1}}
@keyframes edSheet{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
.ed-anim-pop{animation:edPop .26s ease-out}.ed-anim-aparecer{animation:edFade .22s ease-out}.ed-anim-subir{animation:edUp .24s ease-out}
.ed-sheet{animation:edSheet .2s ease-out}
.ed-range{-webkit-appearance:none;appearance:none;background:transparent}
.ed-range::-webkit-slider-runnable-track{height:4px;border-radius:4px;background:linear-gradient(90deg,#ff2bd6 0,#8a5cff var(--pct),var(--line) var(--pct))}
.ed-range::-webkit-slider-thumb{-webkit-appearance:none;margin-top:-7px;height:18px;width:18px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,.18);box-shadow:0 1px 4px rgba(0,0,0,.35)}
.ed-range::-moz-range-track{height:4px;border-radius:4px;background:var(--line)}
.ed-range::-moz-range-progress{height:4px;border-radius:4px;background:linear-gradient(90deg,#ff2bd6,#8a5cff)}
.ed-range::-moz-range-thumb{height:18px;width:18px;border:1px solid rgba(0,0,0,.18);border-radius:50%;background:#fff}
.ed-range:focus-visible{outline:2px solid var(--sel);outline-offset:2px;border-radius:6px}
.ed-root{--sel:#0089a8}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .ed-root{--sel:#19e3ff}}
:root[data-theme="dark"] .ed-root{--sel:#19e3ff}
.ed-root :focus-visible{outline-color:var(--sel)}
@media (prefers-reduced-motion:reduce){.ed-anim-pop,.ed-anim-aparecer,.ed-anim-subir,.ed-sheet{animation:none}}
`;

export default function Editor({ id, inicial }: { id: string; inicial?: Datos }) {
  const [d, setD] = useState<Datos | null>(null);
  const [err, setErr] = useState("");
  const [p, setP] = useState<Proyecto | null>(null);
  const pRef = useRef<Proyecto | null>(null);
  pRef.current = p;
  const hist = useRef<{ past: Proyecto[]; future: Proyecto[] }>({ past: [], future: [] });
  const lastKey = useRef({ k: "", at: 0 });
  const [durs, setDurs] = useState<Record<string, number>>({});
  const [strips, setStrips] = useState<Record<string, Strip | "x">>({});
  const [sel, setSel] = useState<Sel>(null);
  const [subSel, setSubSel] = useState(false); // the subtitle block is selected on the preview (for free dragging)
  const [tool, setTool] = useState<Tool>("cortes");
  const [sheet, setSheet] = useState(false);
  const [wide, setWide] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [guardado, setGuardado] = useState<"" | "guardando" | "ok" | "error">("");
  const [exp, setExp] = useState<{ busy: boolean; since?: number; url?: string; error?: string }>({ busy: false });
  const [aviso, setAviso] = useState("");
  const [atajos, setAtajos] = useState(false);
  const [titulo, setTitulo] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const cur = useRef(0); // the cut being played
  const [musicaUrl, setMusicaUrl] = useState<string | null>(null);
  const [ultimaMusica, setUltimaMusica] = useState<Proyecto["musica"]>(null);
  // the subtitle look: starts as the ad's own; a change made here is saved apart and only used by the export
  const [estiloSub, setEstiloSubRaw] = useState<CaptionStyle>(() => normalizeStyle(undefined));
  const estiloCambiado = useRef(false);
  const setEstiloSub = useCallback((patch: Partial<CaptionStyle>) => { estiloCambiado.current = true; setEstiloSubRaw((s) => normalizeStyle({ ...s, ...patch })); }, []);

  // ---------------------------------------------------------------- load
  useEffect(() => {
    const abrir = (x: Datos) => {
      setD(x); setTitulo(x.titulo);
      setEstiloSubRaw(normalizeStyle(x.subtitulosEstilo ?? undefined));
      setMusicaUrl(x.musica);
      setP(x.proyecto ?? { cortes: x.cortes.map((c: Clip) => ({ clipId: c.id, a: 0, b: 600 })), textos: [], subtitulos: true, subCorr: {}, musica: null, vozVol: 100, formato: (FORMATOS as readonly string[]).includes(x.aspecto) ? (x.aspecto as Proyecto["formato"]) : "9:16", velocidad: 1 });
    };
    if (inicial) { abrir(inicial); return; }
    fetch(`/api/ads/${id}/editor`).then(async (r) => {
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || "No se pudo abrir el editor.");
      abrir(x);
    }).catch((e) => setErr(e.message));
  }, [id, inicial]);
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
  // the frames of each clip for the timeline, one clip after the other
  useEffect(() => {
    if (!d) return;
    let dead = false;
    (async () => {
      for (const c of d.cortes) {
        const r = await tira(c.url).catch(() => null);
        if (dead) return;
        setStrips((m) => ({ ...m, [c.id]: r && r.frames.length ? r : "x" }));
      }
    })();
    return () => { dead = true; };
  }, [d]);
  useEffect(() => { if (p?.musica) setUltimaMusica(p.musica); }, [p?.musica]);

  // ---------------------------------------------------------------- layout: desktop or phone, preview size
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    on(); mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    // the editor takes the whole screen: the page behind it doesn't scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  useLayoutEffect(() => {
    const el = canvas.current; if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [d, p !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- edits, undo, autosave
  /** One edit = one undo step. Edits with the same `key` close together (a slider, typing) are one step. */
  const cambiar = useCallback((fn: (x: Proyecto) => Proyecto, key?: string) => {
    const now = Date.now();
    const merge = Boolean(key) && lastKey.current.k === key && now - lastKey.current.at < 900;
    lastKey.current = { k: key ?? "", at: now };
    const x = pRef.current; if (!x) return;
    if (!merge) { hist.current.past.push(x); hist.current.past = hist.current.past.slice(-60); hist.current.future = []; }
    setP((y) => (y ? fn(y) : y));
  }, []);
  /** A drag: the undo step is taken on the first move, then each move applies without adding steps. */
  const gesto = useCallback(() => {
    let pushed = false;
    return (fn: (x: Proyecto) => Proyecto) => {
      if (!pushed) { const x = pRef.current; if (x) { hist.current.past.push(x); hist.current.past = hist.current.past.slice(-60); hist.current.future = []; } pushed = true; lastKey.current = { k: "", at: 0 }; }
      setP((y) => (y ? fn(y) : y));
    };
  }, []);
  const deshacer = () => { const prev = hist.current.past.pop(); const x = pRef.current; if (!prev || !x) return; hist.current.future.push(x); lastKey.current = { k: "", at: 0 }; setP(prev); };
  const rehacer = () => { const next = hist.current.future.pop(); const x = pRef.current; if (!next || !x) return; hist.current.past.push(x); lastKey.current = { k: "", at: 0 }; setP(next); };
  const firstSave = useRef(true);
  const guardar = useCallback(async (x: Proyecto, st: CaptionStyle) => {
    if (inicial) { setGuardado("ok"); return true; }
    const body = { proyecto: x, ...(estiloCambiado.current ? { subtitulosEstilo: st } : {}) };
    const r = await fetch(`/api/ads/${id}/editor`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setGuardado(r?.ok ? "ok" : "error");
    return Boolean(r?.ok);
  }, [id, inicial]);
  useEffect(() => {
    if (!p) return;
    if (firstSave.current) { firstSave.current = false; return; }
    setGuardado("guardando");
    const h = setTimeout(() => { guardar(p, estiloSub); }, 900);
    return () => clearTimeout(h);
  }, [p, estiloSub, guardar]);
  useEffect(() => { if (!aviso) return; const h = setTimeout(() => setAviso(""), 3500); return () => clearTimeout(h); }, [aviso]);

  async function guardarTitulo() {
    const nuevo = titulo.trim().slice(0, 120);
    if (!d || !nuevo || nuevo === d.titulo) { setTitulo(d?.titulo ?? ""); return; }
    setD({ ...d, titulo: nuevo });
    if (inicial) return;
    const r = await fetch(`/api/data/ads/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ title: nuevo }) }).catch(() => null);
    if (!r?.ok) setAviso("No se pudo cambiar el nombre. Intenta de nuevo.");
  }

  // ---------------------------------------------------------------- timeline maths
  const starts = useMemo(() => { const out: number[] = []; let acc = 0; for (const c of p?.cortes ?? []) { out.push(acc); acc += len(c); } return out; }, [p]);
  const total = useMemo(() => (p ? p.cortes.reduce((a, c) => a + len(c), 0) : 0), [p]);
  const clipOf = useCallback((cid: string) => d?.cortes.find((c) => c.id === cid), [d]);

  // the subtitle words on the edited timeline (preview), grouped in phrases like the export
  const palabras = useMemo(() => {
    if (!p || !d) return [] as SubWord[];
    const out: SubWord[] = [];
    p.cortes.forEach((c, i) => (clipOf(c.clipId)?.palabras ?? []).forEach((w, j) => {
      if (!(w.s >= c.a - 0.05 && w.e <= c.b + 0.3)) return;
      const k = `${c.clipId}:${j}`;
      const text = p.subCorr?.[k] ?? w.w;
      out.push({ w: text, s: Math.max(0, w.s - c.a) + starts[i], e: Math.max(0, Math.min(w.e, c.b) - c.a) + starts[i], k, orig: w.w });
    }));
    return out;
  }, [p, d, starts, clipOf]);
  const frases = useMemo(() => {
    const out: Frase[] = [];
    const n = Math.max(1, estiloSub.words);
    for (let i = 0; i < palabras.length; i += n) { const ws = palabras.slice(i, i + n); out.push({ s: ws[0].s, e: ws[ws.length - 1].e, words: ws }); }
    return out;
  }, [palabras, estiloSub]);
  const frase = useMemo(() => frases.find((f) => f.s <= t && t < f.e + 0.15) ?? null, [frases, t]);

  // ---------------------------------------------------------------- playback (one <video>, cut after cut)
  const cargar = useCallback((i: number, at = 0, play = false) => {
    const v = video.current; if (!v || !p || !d || !p.cortes[i]) return;
    cur.current = i;
    const c = p.cortes[i], src = clipOf(c.clipId)?.url ?? "";
    const go = () => { v.currentTime = c.a + at; v.volume = Math.min(1, p.vozVol / 100); v.playbackRate = p.velocidad; if (play) v.play().catch(() => setPlaying(false)); };
    if (v.src !== new URL(src, location.href).href) { v.src = src; v.onloadeddata = () => { v.onloadeddata = null; go(); }; v.load(); } else go();
  }, [p, d, clipOf]);
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
  function pausar() { video.current?.pause(); audio.current?.pause(); setPlaying(false); }
  function playPause() {
    const v = video.current; if (!v) return;
    if (playing) { pausar(); return; }
    v.playbackRate = p?.velocidad ?? 1;
    if (t >= total - 0.05) buscar(0, true); else v.play().catch(() => null);
    if (audio.current && p?.musica) { audio.current.volume = (p.musica.vol ?? 25) / 100; audio.current.playbackRate = p.velocidad; audio.current.play().catch(() => null); }
    setPlaying(true);
  }
  // keep the preview speed in step with the chosen velocidad, even while paused
  useEffect(() => { const v = video.current, a = audio.current, r = p?.velocidad ?? 1; if (v) v.playbackRate = r; if (a) a.playbackRate = r; }, [p?.velocidad]);

  // ---------------------------------------------------------------- actions
  function borrar() {
    if (!sel || !p) return;
    if (sel.tipo === "corte" && p.cortes.length > 1) cambiar((x) => ({ ...x, cortes: x.cortes.filter((_, k) => k !== sel.i) }));
    if (sel.tipo === "corte" && p.cortes.length < 2) { setAviso("El video necesita al menos un corte."); return; }
    if (sel.tipo === "texto") cambiar((x) => ({ ...x, textos: x.textos.filter((_, k) => k !== sel.i) }));
    setSel(null);
  }
  const mover = (i: number, dir: -1 | 1) => { const j = i + dir; if (!p || j < 0 || j >= p.cortes.length) return; cambiar((x) => { const c = [...x.cortes]; [c[i], c[j]] = [c[j], c[i]]; return { ...x, cortes: c }; }); setSel({ tipo: "corte", i: j }); };
  const moverA = (from: number, to: number) => { cambiar((x) => { const c = [...x.cortes]; const [m] = c.splice(from, 1); c.splice(to, 0, m); return { ...x, cortes: c }; }); setSel({ tipo: "corte", i: to }); };
  function duplicar() {
    if (!p) return;
    if (sel?.tipo === "texto") {
      if (p.textos.length >= 20) { setAviso("Puedes tener hasta 20 textos."); return; }
      const src = p.textos[sel.i];
      cambiar((x) => ({ ...x, textos: [...x.textos, { ...src, id: `t${Date.now().toString(36)}`, y: Math.min(92, src.y + 8) }] }));
      setSel({ tipo: "texto", i: p.textos.length });
      return;
    }
    if (p.cortes.length >= 30) { setAviso("Puedes tener hasta 30 cortes."); return; }
    const i = sel?.tipo === "corte" ? sel.i : cur.current;
    cambiar((x) => ({ ...x, cortes: [...x.cortes.slice(0, i + 1), { ...x.cortes[i] }, ...x.cortes.slice(i + 1)] }));
    setSel({ tipo: "corte", i: i + 1 });
  }
  function dividir() {
    if (!p) return;
    if (sel?.tipo === "texto") {
      const tx = p.textos[sel.i];
      if (t - tx.desde < 0.3 || tx.hasta - t < 0.3 || p.textos.length >= 20) { setAviso("Pon la línea dentro del texto para dividirlo."); return; }
      cambiar((x) => ({ ...x, textos: [...x.textos.slice(0, sel.i), { ...tx, hasta: t }, { ...tx, id: `t${Date.now().toString(36)}`, desde: t }, ...x.textos.slice(sel.i + 1)] }));
      return;
    }
    const i = cur.current, c = p.cortes[i], at = c.a + (t - starts[i]);
    if (at - c.a < 0.4 || c.b - at < 0.4) { setAviso("Muy cerca del borde del corte: muévete un poco para dividir."); return; }
    if (p.cortes.length >= 30) { setAviso("Puedes tener hasta 30 cortes."); return; }
    cambiar((x) => ({ ...x, cortes: [...x.cortes.slice(0, i), { ...c, b: at }, { ...c, a: at }, ...x.cortes.slice(i + 1)] }));
  }
  const setCorte = (i: number, patch: Partial<Corte>) => cambiar((x) => ({ ...x, cortes: x.cortes.map((c, k) => (k === i ? { ...c, ...patch } : c)) }), `corte:${i}:${Object.keys(patch).join()}`);
  const setTexto = (i: number, patch: Partial<Texto>) => cambiar((x) => ({ ...x, textos: x.textos.map((tx, k) => (k === i ? { ...tx, ...patch } : tx)) }), `texto:${i}:${Object.keys(patch).join()}`);
  // spelling fix on one subtitle word: store «clipId:index → new word»; typing the original back (or clearing) removes the fix
  const corregirSub = (k: string, texto: string, orig: string) => cambiar((x) => {
    const next = { ...(x.subCorr ?? {}) };
    const clean = texto.replace(/[{}\\\n\r]/g, "").slice(0, 60).trim();
    if (clean === orig || clean === "") delete next[k]; else next[k] = clean; // empty or same as original = no fix
    return { ...x, subCorr: next };
  }, `sub:${k}`);
  function nuevoTexto(preset: Partial<Texto>) {
    if (!p) return;
    if (p.textos.length >= 20) { setAviso("Puedes tener hasta 20 textos."); return; }
    const desde = Math.min(t, Math.max(0, total - 1));
    const tx: Texto = { id: `t${Date.now().toString(36)}`, texto: "Escribe tu texto", desde, hasta: Math.min(total, desde + 2.5), x: 50, y: 22, tam: 8, color: "#FFFFFF", fondo: "#000000", fuente: "Montserrat ExtraBold", animacion: "pop", ...preset };
    cambiar((x) => ({ ...x, textos: [...x.textos, tx] }));
    setSel({ tipo: "texto", i: p.textos.length }); setTool("texto");
    setTimeout(() => { const el = document.getElementById("ed-texto") as HTMLTextAreaElement | null; if (el && window.matchMedia("(min-width: 1024px)").matches) { el.focus(); el.select(); } }, 60);
  }
  function agregarCorte(clipId: string) {
    if (!p) return;
    if (p.cortes.length >= 30) { setAviso("Puedes tener hasta 30 cortes."); return; }
    cambiar((x) => ({ ...x, cortes: [...x.cortes, { clipId, a: 0, b: durs[clipId] ?? 8 }] }));
    setSel({ tipo: "corte", i: p.cortes.length });
  }
  // drag a text on the video, or one of its corners to resize it
  function arrastrar(i: number, e: React.PointerEvent) {
    const r = frame.current?.getBoundingClientRect(); if (!r || !p) return;
    e.preventDefault(); e.stopPropagation();
    setSel({ tipo: "texto", i }); setTool("texto");
    const apply = gesto();
    const tx0 = p.textos[i], x0 = e.clientX, y0 = e.clientY;
    const move = (ev: PointerEvent) => {
      const x = Math.round(Math.min(95, Math.max(5, tx0.x + ((ev.clientX - x0) / r.width) * 100)));
      const y = Math.round(Math.min(95, Math.max(5, tx0.y + ((ev.clientY - y0) / r.height) * 100)));
      apply((pp) => ({ ...pp, textos: pp.textos.map((tx, k) => (k === i ? { ...tx, x, y } : tx)) }));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  function escalar(i: number, e: React.PointerEvent) {
    const r = frame.current?.getBoundingClientRect(); if (!r || !p) return;
    e.preventDefault(); e.stopPropagation();
    const apply = gesto();
    const tx0 = p.textos[i];
    const cx = r.left + (tx0.x / 100) * r.width, cy = r.top + (tx0.y / 100) * r.height;
    const d0 = Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy));
    const move = (ev: PointerEvent) => {
      const tam = Math.round(Math.min(16, Math.max(3, tx0.tam * (Math.hypot(ev.clientX - cx, ev.clientY - cy) / d0))) * 10) / 10;
      apply((pp) => ({ ...pp, textos: pp.textos.map((tx, k) => (k === i ? { ...tx, tam } : tx)) }));
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  async function subirMusica(f: File | undefined) {
    if (!f) return;
    try {
      const url = await uploadFile(f);
      setMusicaUrl(url);
      cambiar((x) => ({ ...x, musica: { url, nombre: f.name.replace(/\.[^.]+$/, "").slice(0, 60), vol: 25 } }));
    } catch (e) { setAviso(e instanceof Error ? e.message : "No se pudo subir la música."); }
  }
  function musicaOn(on: boolean) {
    if (on && ultimaMusica) cambiar((x) => ({ ...x, musica: ultimaMusica }));
    if (!on) { audio.current?.pause(); cambiar((x) => ({ ...x, musica: null })); }
  }
  const setMusicaVol = (vol: number) => { if (audio.current) audio.current.volume = vol / 100; cambiar((x) => ({ ...x, musica: x.musica ? { ...x.musica, vol } : null }), "musica-vol"); };
  const setVelocidad = (v: number) => cambiar((x) => ({ ...x, velocidad: clampVelocidad(v) }), "velocidad");
  // drag the subtitle block anywhere on the preview (sets the caption style's x/y in %, like a text layer)
  function arrastrarSub(e: React.PointerEvent) {
    const r = frame.current?.getBoundingClientRect(); if (!r) return;
    e.preventDefault(); e.stopPropagation();
    setSubSel(true); setSel(null); setTool("subtitulos");
    const free = estiloSub.y !== undefined ? { x: estiloSub.x ?? 50, y: estiloSub.y } : null;
    const x0 = e.clientX, y0 = e.clientY;
    const cl = (v: number, lo: number, hi: number) => Math.round(Math.min(hi, Math.max(lo, v)));
    const move = (ev: PointerEvent) => {
      const x = free ? cl(free.x + ((ev.clientX - x0) / r.width) * 100, 8, 92) : cl(((ev.clientX - r.left) / r.width) * 100, 8, 92);
      const y = free ? cl(free.y + ((ev.clientY - y0) / r.height) * 100, 6, 94) : cl(((ev.clientY - r.top) / r.height) * 100, 6, 94);
      setEstiloSub({ x, y });
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }
  async function exportar() {
    if (!p) return;
    pausar();
    setExp({ busy: true, since: Date.now() });
    // the export reads the subtitle look from the saved ad: save first so the last change is in
    if (estiloCambiado.current) await guardar(p, estiloSub);
    const r = await fetch(`/api/ads/${id}/editor/exportar`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ proyecto: p }) }).catch(() => null);
    const x = r ? await r.json().catch(() => ({})) : {};
    setExp(r?.ok ? { busy: false, url: x.url } : { busy: false, error: x.error || "No se pudo exportar. Intenta de nuevo." });
  }
  function abrir(tl: Tool) { setTool(tl); if (!wide) setSheet(true); }

  // ---------------------------------------------------------------- keyboard
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.tagName === "SELECT" || el?.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === "Space") { e.preventDefault(); playPause(); }
      else if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); }
      else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); rehacer(); }
      else if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); dividir(); }
      else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicar(); }
      else if ((e.key === "Delete" || e.key === "Backspace") && sel) { e.preventDefault(); borrar(); }
      else if (e.key === "Escape") { setSel(null); setSubSel(false); setSheet(false); setAtajos(false); }
      else if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); if (playing) pausar(); buscar(t + (e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 1 : 0.1), false); }
      else if (e.key === "Home") { e.preventDefault(); buscar(0, false); }
      else if (e.key === "End") { e.preventDefault(); buscar(total, false); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });

  // ---------------------------------------------------------------- view
  if (err) return <div className="flex flex-col gap-3 p-4"><p className="text-bad">{err}</p><Link href="/app/editor" className="underline">Volver al editor</Link></div>;
  if (!d || !p) return <div className="fixed inset-0 z-[56] grid place-items-center bg-bg text-muted"><Working label="Abriendo el editor…" /></div>;

  const ed: Ed = {
    d, p, t, total, starts, durs, playing, sel, setSel, tool, abrir, setTool, cambiar, gesto, setCorte, setTexto, buscar, pausar, setT, clipOf, strips,
    frases, estiloSub, setEstiloSub, corregirSub, dividir, duplicar, borrar, mover, moverA, nuevoTexto, agregarCorte, musicaUrl, subirMusica, musicaOn, ultimaMusica, setMusicaVol, setVelocidad,
  };
  const r = RATIO[p.formato];
  const padC = wide ? 40 : 16;
  const fw = Math.max(0, Math.min(box.w - padC * 2, (box.h - padC * 2) * r));
  const fh = fw / r;
  const hayDeshacer = hist.current.past.length > 0, hayRehacer = hist.current.future.length > 0;
  const toolInfo = TOOLS.find((x) => x.id === tool)!;
  const guardadoTxt = guardado === "guardando" ? "Guardando…" : guardado === "ok" ? "Guardado" : guardado === "error" ? "Sin guardar" : "";
  // the clock shows the final (sped-up) time, so what you read matches what you export
  const salida = (s: number) => s / (p.velocidad || 1);

  const exportBtn = (
    <button type="button" onClick={exportar} disabled={exp.busy}
      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[image:var(--grad)] px-4 text-sm font-bold text-white shadow-[0_8px_24px_-10px_rgba(255,43,214,0.8)] transition-transform hover:-translate-y-px active:scale-[0.98] disabled:opacity-80 lg:h-10 lg:px-5">
      {exp.busy ? <Working since={exp.since} label="Exportando…" /> : <><Icon name="upload" className="h-4 w-4" />Exportar</>}
    </button>
  );

  return (
    <div className="ed-root fixed inset-0 z-[56] flex flex-col overflow-hidden bg-bg text-ink" lang="es">
      <style>{CSS}</style>

      {/* ------------------------------------------------ top bar */}
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line bg-surface px-2 pt-[env(safe-area-inset-top)] lg:gap-2 lg:px-3">
        <Link href="/app/editor" aria-label="Volver a mis videos" title="Volver" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-ink lg:h-9 lg:w-9"><Icon name="back" /></Link>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} onBlur={guardarTitulo} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setTitulo(d.titulo); (e.target as HTMLInputElement).blur(); } }}
            aria-label="Nombre del video" maxLength={120}
            className="h-11 w-full min-w-0 max-w-[420px] truncate rounded-lg border border-transparent bg-transparent px-2 text-[15px] font-semibold text-ink hover:border-line focus:border-line focus:bg-surface-2 lg:h-10" />
        </div>
        <span className={`hidden shrink-0 items-center gap-1 px-2 text-[13px] sm:flex ${guardado === "error" ? "text-bad" : "text-muted"}`} aria-live="polite">
          {guardado === "ok" && <Icon name="check" className="h-3.5 w-3.5 text-good" />}{guardadoTxt}
        </span>
        <span className="hidden items-center gap-0.5 lg:flex">
          <IconBtn icon="undo" label="Deshacer (Ctrl+Z)" onClick={deshacer} disabled={!hayDeshacer} />
          <IconBtn icon="redo" label="Rehacer (Ctrl+Shift+Z)" onClick={rehacer} disabled={!hayRehacer} />
          <span className="mx-2 h-6 w-px bg-line" />
        </span>
        {exportBtn}
      </header>

      {/* ------------------------------------------------ export result / notices */}
      {(exp.url || exp.error || aviso) && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-40 flex justify-center px-3">
          <div role={exp.error ? "alert" : "status"} className={`pointer-events-auto flex max-w-xl flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-3 text-sm shadow-2xl ${exp.error ? "border-bad/50 bg-surface text-ink" : "border-line bg-surface text-ink"}`}>
            {exp.url ? <><b className="flex items-center gap-1.5"><Icon name="check" className="h-4 w-4 text-good" />Listo: tu video editado quedó en Mis anuncios.</b><a href={dl(exp.url)} target="_blank" rel="noreferrer" className="font-semibold text-accent-text underline">Descargar</a></>
              : exp.error ? <span>{exp.error}</span> : <span>{aviso}</span>}
            {(exp.url || exp.error) && <button type="button" onClick={() => setExp({ busy: false })} aria-label="Cerrar aviso" className="-mr-2 ml-auto grid h-8 w-8 place-items-center rounded-lg text-muted hover:text-ink"><Icon name="close" className="h-4 w-4" /></button>}
          </div>
        </div>
      )}

      {/* ------------------------------------------------ middle: rail, panel, preview */}
      <div className="flex min-h-0 flex-1">
        {wide && (
          <nav aria-label="Herramientas" className="flex w-[76px] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface py-3">
            {TOOLS.map((x) => {
              const on = tool === x.id;
              return (
                <button key={x.id} type="button" onClick={() => setTool(x.id)} aria-pressed={on} title={x.desc}
                  className={`flex w-[64px] flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-semibold transition-colors ${on ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2/60 hover:text-ink"}`}>
                  <span className={`grid h-8 w-8 place-items-center rounded-lg ${on ? "bg-[image:var(--grad)] text-white" : ""}`}><Icon name={x.icon} className="h-[18px] w-[18px]" /></span>
                  {x.label}
                </button>
              );
            })}
          </nav>
        )}
        {wide && (
          <aside aria-label={toolInfo.label} className="flex w-[336px] shrink-0 flex-col border-r border-line bg-surface">
            <div className="shrink-0 border-b border-line/70 px-5 pt-3.5 pb-3">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold"><span className="grid h-6 w-6 place-items-center rounded-md bg-surface-2 text-muted"><Icon name={toolInfo.icon} className="h-4 w-4" /></span>{toolInfo.label}</h2>
              <p className="mt-1.5 text-[13px] leading-snug text-muted">{toolInfo.desc}</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-6">
              <Panel ed={ed} />
            </div>
          </aside>
        )}

        <div ref={canvas} className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[radial-gradient(ellipse_at_50%_40%,#14151b,#050608_70%)]">
          <div ref={frame} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-md bg-black shadow-[0_20px_60px_-20px_rgba(0,0,0,.9)] ring-1 ring-white/10" style={{ width: fw, height: fh }}
            onPointerDown={(e) => { if (e.target === e.currentTarget || e.target === video.current) { if (sel?.tipo === "texto") setSel(null); else if (subSel) setSubSel(false); else playPause(); } }}>
            <video ref={video} playsInline onTimeUpdate={onTime} className="absolute inset-0 h-full w-full object-cover" />
            {p.subtitulos && frase && fw > 0 && <SubtituloLinea st={estiloSub} words={frase.words} now={t} formato={p.formato} fw={fw} fh={fh} selected={subSel} onPointerDown={arrastrarSub} />}
            {p.textos.map((tx, i) => {
              const vis = t >= tx.desde && t < tx.hasta;
              const on = sel?.tipo === "texto" && sel.i === i;
              if (!vis && !on) return null;
              return (
                <span key={tx.id} onPointerDown={(e) => arrastrar(i, e)} onDoubleClick={() => setTimeout(() => document.getElementById("ed-texto")?.focus(), 30)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move touch-none ${!vis ? "opacity-45" : ""}`}
                  style={{ left: `${tx.x}%`, top: `${tx.y}%`, maxWidth: "92%", outline: on ? `1.5px solid ${SELECT}` : undefined, outlineOffset: 5, borderRadius: 4 }}>
                  <span key={vis ? "v" : "h"} className={`block whitespace-pre-wrap rounded-[0.18em] px-[0.3em] py-[0.08em] text-center leading-[1.1] ${vis && playing ? `ed-anim-${tx.animacion}` : ""}`}
                    style={{ color: tx.color, background: tx.fondo ?? "transparent", fontFamily: `"${tx.fuente}", var(--font-display), sans-serif`, fontSize: (tx.tam / 100) * fw, textShadow: tx.fondo ? "none" : "0 2px 4px rgba(0,0,0,.8)" }}>{tx.texto}</span>
                  {on && (["-top-[9px] -left-[9px] cursor-nwse-resize", "-top-[9px] -right-[9px] cursor-nesw-resize", "-bottom-[9px] -left-[9px] cursor-nesw-resize", "-bottom-[9px] -right-[9px] cursor-nwse-resize"] as const).map((c) => (
                    <span key={c} onPointerDown={(e) => escalar(i, e)} aria-hidden="true" className={`absolute grid h-6 w-6 place-items-center ${c}`}>
                      <span className="h-2.5 w-2.5 rounded-sm border-[1.5px] bg-white" style={{ borderColor: SELECT }} />
                    </span>
                  ))}
                </span>
              );
            })}
          </div>
          {musicaUrl && <audio ref={audio} src={musicaUrl} loop preload="auto" />}
        </div>
      </div>

      {/* ------------------------------------------------ transport */}
      {wide ? (
        <div className="flex h-12 shrink-0 items-center gap-1 border-t border-line bg-surface px-3">
          <div className="flex flex-1 items-center gap-0.5">
            <ToolBtn icon="scissors" label="Dividir" kbd="Ctrl+B" onClick={dividir} disabled={!total} />
            <ToolBtn icon="copy" label="Duplicar" kbd="Ctrl+D" onClick={duplicar} />
            <ToolBtn icon="trash" label="Borrar" kbd="Supr" onClick={borrar} disabled={!sel} />
          </div>
          <div className="flex items-center gap-1">
            <IconBtn icon="start" label="Ir al inicio" onClick={() => buscar(0, false)} />
            <button type="button" onClick={playPause} aria-label={playing ? "Pausar (espacio)" : "Reproducir (espacio)"} title={playing ? "Pausar (espacio)" : "Reproducir (espacio)"} className="grid h-10 w-10 place-items-center rounded-full bg-ink text-bg transition-transform hover:scale-105 active:scale-95">
              <Icon name={playing ? "pause" : "play"} className="h-5 w-5" />
            </button>
            <IconBtn icon="end" label="Ir al final" onClick={() => buscar(total, false)} />
            <span className="ml-2 font-mono text-[13px] text-muted tabular-nums"><span className="text-ink">{fmt(salida(t))}</span> / {fmt(salida(total))}{p.velocidad !== 1 && <span className="ml-1 text-accent-text">· {p.velocidad}x</span>}</span>
          </div>
          <div className="relative flex flex-1 items-center justify-end gap-1">
            <button type="button" onClick={() => setAtajos((v) => !v)} aria-expanded={atajos} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-muted hover:bg-surface-2 hover:text-ink"><Icon name="keys" className="h-4 w-4" />Atajos</button>
            {atajos && (
              <div className="absolute right-0 bottom-11 z-40 w-72 rounded-xl border border-line bg-surface-2 p-3 text-[13px] shadow-2xl">
                {[["Espacio", "Reproducir o pausar"], ["← →", "Mover 0,1 s (con Shift, 1 s)"], ["Ctrl+B", "Dividir"], ["Ctrl+D", "Duplicar"], ["Supr", "Borrar lo seleccionado"], ["Ctrl+Z", "Deshacer"], ["Ctrl+Shift+Z", "Rehacer"], ["Esc", "Quitar la selección"]].map(([a, b]) => (
                  <div key={a} className="flex justify-between gap-3 py-1"><kbd className="rounded border border-line bg-surface px-1.5 font-mono text-[12px] text-ink">{a}</kbd><span className="text-muted">{b}</span></div>
                ))}
              </div>
            )}
            <span className="mx-1 h-6 w-px bg-line" />
            <IconBtn icon="minus" label="Alejar" onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.5) * 10) / 10))} disabled={zoom <= 1} />
            <input type="range" min={1} max={10} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom de la línea de tiempo" className="ed-range h-6 w-28" style={{ "--pct": `${((zoom - 1) / 9) * 100}%` } as React.CSSProperties} />
            <IconBtn icon="plus" label="Acercar" onClick={() => setZoom((z) => Math.min(10, z + 0.5))} disabled={zoom >= 10} />
            <IconBtn icon="fit" label="Ajustar a la pantalla" onClick={() => setZoom(1)} />
          </div>
        </div>
      ) : (
        <div className="grid h-12 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-t border-line bg-surface px-2">
          <span className="pl-1 font-mono text-[13px] text-muted tabular-nums"><span className="text-ink">{fmt(salida(t))}</span> / {fmt(salida(total))}{p.velocidad !== 1 && <span className="ml-1 text-accent-text">· {p.velocidad}x</span>}</span>
          <button type="button" onClick={playPause} aria-label={playing ? "Pausar" : "Reproducir"} className="grid h-11 w-11 place-items-center rounded-full text-ink active:scale-95">
            <Icon name={playing ? "pause" : "play"} className="h-7 w-7" />
          </button>
          <span className="flex justify-end">
            <IconBtn icon="undo" label="Deshacer" onClick={deshacer} disabled={!hayDeshacer} />
            <IconBtn icon="redo" label="Rehacer" onClick={rehacer} disabled={!hayRehacer} />
          </span>
        </div>
      )}

      {/* ------------------------------------------------ timeline, or (phone) the tool's sheet */}
      {!wide && sheet ? (
        <section aria-label={toolInfo.label} className="ed-sheet flex max-h-[52svh] min-h-[46svh] shrink-0 flex-col rounded-t-2xl border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
          <div className="flex min-h-12 shrink-0 items-center justify-between gap-2 pr-2 pl-4 pt-1">
            <div className="flex min-w-0 flex-col py-1">
              <h2 className="flex items-center gap-2 font-display text-[15px] font-semibold"><Icon name={toolInfo.icon} className="h-4 w-4" />{toolInfo.label}</h2>
              <p className="truncate text-[12px] text-muted">{toolInfo.desc}</p>
            </div>
            <button type="button" onClick={() => setSheet(false)} className="inline-flex h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-ink"><Icon name="check" className="h-4 w-4" />Listo</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-5"><Panel ed={ed} /></div>
        </section>
      ) : (
        <>
          <div className="shrink-0 border-t border-line bg-bg py-1.5">
            <Timeline ed={ed} centered={!wide} zoom={wide ? zoom : 1} />
          </div>
          {!wide && (
            <nav aria-label={sel ? "Acciones" : "Herramientas"} className="shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
              {sel ? (
                <div className="grid h-16 grid-cols-5">
                  {[
                    { icon: "pen", label: "Editar", on: () => abrir(sel.tipo === "corte" ? "cortes" : "texto") },
                    { icon: "scissors", label: "Dividir", on: dividir },
                    { icon: "copy", label: "Duplicar", on: duplicar },
                    { icon: "trash", label: "Borrar", on: borrar },
                    { icon: "close", label: "Cerrar", on: () => setSel(null) },
                  ].map((a) => (
                    <button key={a.label} type="button" onClick={a.on} className="flex flex-col items-center justify-center gap-1 text-[12px] font-semibold text-muted active:text-ink">
                      <Icon name={a.icon} className="h-5 w-5 text-ink" />{a.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid h-16 grid-cols-6">
                  {TOOLS.map((x) => (
                    <button key={x.id} type="button" onClick={() => abrir(x.id)} title={x.desc} className="flex min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-[11px] font-semibold text-muted active:text-ink">
                      <Icon name={x.icon} className="h-5 w-5 text-ink" /><span className="max-w-full truncate">{x.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
