"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Proyecto } from "@/lib/editor-tipos";
import { type Ed, Icon, SEL, fmtRegla, len } from "./piezas";

// The multi-track timeline: ruler, playhead, a video track (cuts with frames, trims, drag to reorder), the texts
// over time, the subtitles and the music. Desktop: the playhead moves and you scrub it; phone (CapCut style):
// the playhead stays in the middle and the tracks scroll under it.

interface Props { ed: Ed; centered: boolean; zoom: number }

const LANE = {
  wide: { ruler: 26, video: 64, texto: 26, subs: 24, audio: 30, gap: 6 },
  phone: { ruler: 22, video: 54, texto: 26, subs: 22, audio: 26, gap: 5 },
};

/** Greedy rows so texts that overlap in time don't cover each other. */
function filas(textos: Proyecto["textos"]) {
  const order = textos.map((x, i) => ({ i, a: x.desde, b: x.hasta })).sort((x, y) => x.a - y.a);
  const ends: number[] = [];
  const row: number[] = [];
  for (const o of order) {
    let r = ends.findIndex((e) => e <= o.a + 0.01);
    if (r < 0) { r = ends.length; ends.push(0); }
    ends[r] = o.b; row[o.i] = r;
  }
  return { row, n: Math.max(1, ends.length) };
}

export default function Timeline({ ed, centered, zoom }: Props) {
  const { p, total, starts, t, sel } = ed;
  const L = centered ? LANE.phone : LANE.wide;
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el); setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const pad = centered ? Math.round(w / 2) : 14;
  // pixels per second: desktop fits the whole video at zoom 1; phone keeps a fixed, finger-friendly scale
  const END = 56; // room after the last cut for the «add a clip» button
  const pps = centered ? 46 * zoom : Math.max(4, ((w - pad * 2 - END) / Math.max(total, 1)) * zoom);
  const X = (s: number) => pad + s * pps;
  const width = pad * 2 + total * pps + END;

  // ---------------------------------------------------------------- playhead follows the video
  const lastT = useRef(-1);
  useEffect(() => {
    const el = scroller.current; if (!el || !w) return;
    if (centered) { lastT.current = t; el.scrollLeft = t * pps; return; }
    const x = X(t);
    if (x < el.scrollLeft + 20 || x > el.scrollLeft + el.clientWidth - 40) el.scrollLeft = Math.max(0, x - (ed.playing ? 40 : el.clientWidth / 2));
  }, [t, pps, w, centered]); // eslint-disable-line react-hooks/exhaustive-deps

  // phone: scrolling the tracks moves the playhead (it stays in the middle)
  const raf = useRef(0);
  function onScroll() {
    if (!centered) return;
    const el = scroller.current; if (!el) return;
    const tt = Math.max(0, Math.min(total, el.scrollLeft / pps));
    if (Math.abs(tt - lastT.current) * pps < 1.5) return;
    lastT.current = tt;
    if (ed.playing) ed.pausar();
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => ed.buscar(tt, false));
  }

  // ---------------------------------------------------------------- scrubbing (desktop)
  const timeAt = (clientX: number) => {
    const r = content.current?.getBoundingClientRect(); if (!r) return 0;
    return Math.max(0, Math.min(total, (clientX - r.left - pad) / pps));
  };
  function scrub(e: React.PointerEvent) {
    if (centered || e.button !== 0) return;
    e.preventDefault();
    if (ed.playing) ed.pausar();
    ed.buscar(timeAt(e.clientX), false);
    let pending = 0;
    const move = (ev: PointerEvent) => { cancelAnimationFrame(pending); const x = timeAt(ev.clientX); pending = requestAnimationFrame(() => ed.buscar(x, false)); };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  // ---------------------------------------------------------------- ruler
  const ticks = useMemo(() => {
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60];
    const major = steps.find((s) => s * pps >= (centered ? 70 : 80)) ?? 60;
    const minor = major / (major === 0.25 || major === 2.5 ? 5 : major >= 1 && major % 2 === 1 ? 5 : 4);
    const out: { s: number; big: boolean }[] = [];
    for (let s = 0; s <= total + 1e-6; s += minor) out.push({ s: Math.round(s * 1000) / 1000, big: Math.abs(s / major - Math.round(s / major)) < 1e-6 });
    return { out, fino: major < 1 };
  }, [pps, total, centered]);

  // ---------------------------------------------------------------- drags on blocks
  const [drag, setDrag] = useState<{ i: number; dx: number; to: number } | null>(null);

  /** Pointer gesture: a click (no movement) or a horizontal drag in seconds. */
  function gesture(e: React.PointerEvent, onMove: (ds: number) => void, onEnd: (moved: boolean, ev: PointerEvent) => void, onStart?: () => void) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;
    const mouse = e.pointerType === "mouse";
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      if (!moved) { moved = true; onStart?.(); }
      onMove((ev.clientX - x0) / pps);
    };
    const cleanup = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", cleanup); };
    // a swipe that scrolled the tracks (the browser cancels the pointer) is not a tap
    const up = (ev: PointerEvent) => { cleanup(); if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) return; onEnd(moved, ev); };
    // phones: blocks don't drag (the finger scrolls the timeline); trims have their own handles
    if (mouse || !centered) window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up); window.addEventListener("pointercancel", cleanup);
  }

  function trimCorte(e: React.PointerEvent, i: number, side: "a" | "b") {
    e.preventDefault();
    ed.setSel({ tipo: "corte", i }); ed.setTool("cortes");
    if (ed.playing) ed.pausar();
    const c0 = p.cortes[i], dur = ed.durs[c0.clipId] ?? Math.max(c0.b, 8), start = starts[i];
    const apply = ed.gesto();
    const x0 = e.clientX;
    const move = (ev: PointerEvent) => {
      const ds = (ev.clientX - x0) / pps;
      if (side === "a") {
        const a = Math.max(0, Math.min(c0.b - 0.3, c0.a + ds));
        apply((x) => ({ ...x, cortes: x.cortes.map((c, k) => (k === i ? { ...c, a } : c)) }));
        ed.setT(start);
      } else {
        const b = Math.min(dur, Math.max(c0.a + 0.3, c0.b + ds));
        apply((x) => ({ ...x, cortes: x.cortes.map((c, k) => (k === i ? { ...c, b } : c)) }));
        ed.setT(start + (b - c0.a) - 0.05);
      }
    };
    const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  }

  function pressCorte(e: React.PointerEvent, i: number) {
    const localT = timeAt(e.clientX);
    gesture(e, (ds) => {
      const dx = ds * pps;
      const mid = X(starts[i]) + (len(p.cortes[i]) * pps) / 2 + dx;
      let to = 0;
      p.cortes.forEach((c, k) => { if (k !== i && X(starts[k]) + (len(c) * pps) / 2 < mid) to++; });
      setDrag({ i, dx, to });
    }, (moved) => {
      if (moved) {
        setDrag((d) => { if (d && d.to !== d.i) ed.moverA(d.i, d.to); return null; });
      } else {
        ed.setSel({ tipo: "corte", i }); ed.setTool("cortes");
        ed.buscar(Math.min(starts[i] + len(p.cortes[i]) - 0.02, Math.max(starts[i], localT)), false);
      }
    });
  }

  function pressTexto(e: React.PointerEvent, i: number, side?: "desde" | "hasta") {
    const tx0 = p.textos[i];
    let apply: ((fn: (x: Proyecto) => Proyecto) => void) | null = null;
    const localT = timeAt(e.clientX);
    if (side) e.preventDefault();
    gesture(e, (ds) => {
      if (!apply) return;
      let desde = tx0.desde, hasta = tx0.hasta;
      if (side === "desde") desde = Math.max(0, Math.min(tx0.hasta - 0.3, tx0.desde + ds));
      else if (side === "hasta") hasta = Math.min(total, Math.max(tx0.desde + 0.3, tx0.hasta + ds));
      else { const dl = tx0.hasta - tx0.desde; desde = Math.max(0, Math.min(total - dl, tx0.desde + ds)); hasta = desde + dl; }
      apply((x) => ({ ...x, textos: x.textos.map((tx, k) => (k === i ? { ...tx, desde: Math.round(desde * 100) / 100, hasta: Math.round(hasta * 100) / 100 } : tx)) }));
    }, (moved) => {
      if (!moved) { ed.setSel({ tipo: "texto", i }); ed.setTool("texto"); if (!side) ed.buscar(Math.min(tx0.hasta - 0.02, Math.max(tx0.desde, localT)), false); }
    }, () => { ed.setSel({ tipo: "texto", i }); ed.setTool("texto"); apply = ed.gesto(); });
    // handles on touch: the gesture above only listens to mouse moves on phones, so trims need their own listener
    if (side && e.pointerType !== "mouse") {
      apply = ed.gesto();
      ed.setSel({ tipo: "texto", i });
      const x0 = e.clientX;
      const move = (ev: PointerEvent) => {
        const ds = (ev.clientX - x0) / pps;
        const desde = side === "desde" ? Math.max(0, Math.min(tx0.hasta - 0.3, tx0.desde + ds)) : tx0.desde;
        const hasta = side === "hasta" ? Math.min(total, Math.max(tx0.desde + 0.3, tx0.hasta + ds)) : tx0.hasta;
        apply!((x) => ({ ...x, textos: x.textos.map((tx, k) => (k === i ? { ...tx, desde, hasta } : tx)) }));
      };
      const up = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
      window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    }
  }

  const tf = useMemo(() => filas(p.textos), [p.textos]);
  const textoH = tf.n * L.texto + (tf.n - 1) * 3;
  const rows = [L.ruler, L.video, textoH, L.subs, L.audio];
  const top = (k: number) => rows.slice(0, k).reduce((a, b) => a + b, 0) + k * L.gap;
  const height = top(rows.length) + 6;
  const selCorte = sel?.tipo === "corte" ? sel.i : -1;
  const selTexto = sel?.tipo === "texto" ? sel.i : -1;

  const heads: { icon: string; label: string; h: number; extra?: React.ReactNode }[] = [
    { icon: "film", label: "Video", h: L.video },
    { icon: "text", label: "Texto", h: textoH },
    { icon: "cc", label: "Subtítulos", h: L.subs, extra: (
      <button type="button" onClick={() => ed.cambiar((x) => ({ ...x, subtitulos: !x.subtitulos }))} aria-label={p.subtitulos ? "Ocultar subtítulos" : "Mostrar subtítulos"} title={p.subtitulos ? "Ocultar subtítulos" : "Mostrar subtítulos"}
        className="ml-auto grid h-6 w-6 place-items-center rounded text-muted hover:text-ink"><Icon name={p.subtitulos ? "eye" : "eyeoff"} className="h-3.5 w-3.5" /></button>
    ) },
    { icon: "music", label: "Audio", h: L.audio },
  ];

  return (
    <div className="relative flex min-h-0 min-w-0 select-none" style={{ height }}>
      {!centered && (
        <div className="flex w-[118px] shrink-0 flex-col border-r border-line bg-surface" aria-hidden="false">
          <div style={{ height: L.ruler + L.gap }} />
          {heads.map((h) => (
            <div key={h.label} className="flex items-start gap-1.5 px-3 pt-1 text-[13px] font-semibold text-muted" style={{ height: h.h, marginBottom: L.gap }}>
              <Icon name={h.icon} className="mt-px h-3.5 w-3.5 shrink-0" />{h.label}{h.extra}
            </div>
          ))}
        </div>
      )}
      <div ref={scroller} onScroll={onScroll} className={`scroll-row relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden ${centered ? "touch-pan-x" : ""}`} aria-label="Línea de tiempo" role="region">
        <div ref={content} className="relative" style={{ width, height }} onPointerDown={(e) => { if (e.target === e.currentTarget) scrub(e); }}>
          {/* ruler */}
          <div className={`absolute inset-x-0 top-0 border-b border-line ${centered ? "" : "cursor-ew-resize"}`} style={{ height: L.ruler }} onPointerDown={scrub}>
            {ticks.out.map((k) => (
              <span key={k.s} className="absolute bottom-0 w-px bg-ink/25" style={{ left: X(k.s), height: k.big ? 8 : 4 }}>
                {k.big && <span className="absolute bottom-2 left-1 font-mono text-[11px] whitespace-nowrap text-muted tabular-nums">{fmtRegla(k.s, ticks.fino)}</span>}
              </span>
            ))}
          </div>

          {/* video track */}
          <div className="absolute inset-x-0" style={{ top: top(1), height: L.video }} onPointerDown={(e) => { if (e.target === e.currentTarget) scrub(e); }}>
            {p.cortes.map((c, i) => {
              const on = selCorte === i;
              const left = X(starts[i]) + 1, wd = Math.max(6, len(c) * pps - 2);
              const dragging = drag?.i === i;
              const clip = ed.clipOf(c.clipId);
              return (
                <div key={i} role="button" tabIndex={0} aria-pressed={on} aria-label={`Corte ${i + 1}, ${len(c).toFixed(1)} segundos`}
                  onKeyDown={(e) => { if (e.key === "Enter") { ed.setSel({ tipo: "corte", i }); ed.setTool("cortes"); } }}
                  onPointerDown={(e) => pressCorte(e, i)}
                  className={`group absolute top-0 overflow-hidden rounded-lg bg-surface-2 focus-visible:outline-offset-[-2px] ${on ? "z-[2]" : ""} ${dragging ? "z-10 cursor-grabbing opacity-90 shadow-2xl shadow-black" : "cursor-pointer"}`}
                  style={{ left, width: wd, height: L.video, transform: dragging ? `translateX(${drag.dx}px)` : undefined, boxShadow: on ? `0 0 0 2px ${SEL}` : "inset 0 0 0 1px rgba(127,127,127,.25)" }}>
                  <Tira ed={ed} clipId={c.clipId} a={c.a} wd={wd} h={L.video} pps={pps} url={clip?.url} />
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
                  {wd > 34 && <span style={{ left: on ? (centered ? 24 : 18) : 6 }} className="pointer-events-none absolute top-1 rounded bg-black/55 px-1 font-mono text-[11px] font-semibold text-white tabular-nums">{len(c).toFixed(1)}s</span>}
                  {wd > 70 && !centered && <span style={{ left: on ? 18 : 6, right: on ? 18 : 6 }} className="pointer-events-none absolute bottom-1 truncate text-[11px] font-semibold text-white/85">{clip?.texto || `Corte ${(clip?.idx ?? 0) + 1}`}</span>}
                  {(["a", "b"] as const).map((side) => (
                    <span key={side} onPointerDown={(e) => { e.stopPropagation(); trimCorte(e, i, side); }} aria-hidden="true"
                      className={`absolute top-0 bottom-0 z-[3] flex ${centered ? "w-5" : "w-3.5"} cursor-ew-resize touch-none items-center justify-center ${side === "a" ? "left-0 rounded-l-lg" : "right-0 rounded-r-lg"} ${on ? "opacity-100" : "opacity-0 group-hover:opacity-100"} ${centered && !on ? "pointer-events-none" : ""}`}
                      style={{ background: SEL }}>
                      <span className="h-4 w-[2px] rounded bg-black/60" />
                    </span>
                  ))}
                </div>
              );
            })}
            <button type="button" onClick={() => ed.abrir("cortes")} aria-label="Agregar un clip" title="Agregar un clip"
              className="absolute top-0 grid place-items-center rounded-lg border border-dashed border-line bg-surface/60 text-muted transition-colors hover:border-ink/30 hover:text-ink"
              style={{ left: X(total) + 8, width: END - 12, height: L.video }}>
              <Icon name="plus" className="h-5 w-5" />
            </button>
            {drag && drag.to !== drag.i && (() => {
              const others = p.cortes.map((_, k) => k).filter((k) => k !== drag.i);
              const last = others[others.length - 1];
              const x = drag.to < others.length ? X(starts[others[drag.to]]) : X(starts[last] + len(p.cortes[last]));
              return <span className="pointer-events-none absolute -top-1 -bottom-1 z-20 w-[3px] -translate-x-1/2 rounded bg-ink" style={{ left: x }} />;
            })()}
          </div>

          {/* texts */}
          <div className="absolute inset-x-0" style={{ top: top(2), height: textoH }} onPointerDown={(e) => { if (e.target === e.currentTarget) scrub(e); }}>
            {p.textos.map((tx, i) => {
              const on = selTexto === i;
              const wd = Math.max(10, (tx.hasta - tx.desde) * pps);
              return (
                <div key={tx.id} role="button" tabIndex={0} aria-pressed={on} aria-label={`Texto: ${tx.texto}`}
                  onKeyDown={(e) => { if (e.key === "Enter") { ed.setSel({ tipo: "texto", i }); ed.setTool("texto"); } }}
                  onPointerDown={(e) => pressTexto(e, i)}
                  className="group absolute flex cursor-pointer items-center overflow-hidden rounded-md text-[12px] font-semibold text-white focus-visible:outline-offset-[-2px]"
                  style={{ left: X(tx.desde), width: wd, top: tf.row[i] * (L.texto + 3), height: L.texto, background: on ? "#7347f0" : "#8A5CFF", boxShadow: on ? `0 0 0 2px ${SEL}` : "inset 0 0 0 1px rgba(255,255,255,.14)" }}>
                  <span className="pointer-events-none truncate px-2"><span className="mr-1 opacity-70">T</span>{tx.texto}</span>
                  {(["desde", "hasta"] as const).map((side) => (
                    <span key={side} onPointerDown={(e) => { e.stopPropagation(); pressTexto(e, i, side); }} aria-hidden="true"
                      className={`absolute top-0 bottom-0 z-[2] w-2.5 cursor-ew-resize touch-none ${side === "desde" ? "left-0" : "right-0"} ${on ? "opacity-100" : "opacity-0 group-hover:opacity-100"} ${centered && !on ? "pointer-events-none" : ""}`}
                      style={{ background: SEL }} />
                  ))}
                </div>
              );
            })}
            {!p.textos.length && (
              <button type="button" onClick={() => ed.abrir("texto")} className="absolute flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 text-[12px] font-semibold text-muted hover:text-ink"
                style={{ left: pad, height: L.texto, width: Math.min(240, Math.max(150, total * pps)) }}>
                <Icon name="plus" className="h-3.5 w-3.5" />Agregar texto
              </button>
            )}
          </div>

          {/* subtitles */}
          <div className={`absolute inset-x-0 ${p.subtitulos ? "" : "opacity-35"}`} style={{ top: top(3), height: L.subs }} onPointerDown={(e) => { if (e.target === e.currentTarget) scrub(e); }}>
            {ed.frases.map((f, k) => (
              <button key={k} type="button" tabIndex={-1} onClick={() => { ed.setTool("subtitulos"); ed.buscar(f.s + 0.01, false); }}
                className="absolute top-0 truncate rounded bg-ink/[0.07] px-1.5 text-left text-[11px] leading-[22px] text-ink/75 hover:bg-ink/[0.14]"
                style={{ left: X(f.s), width: Math.max(4, (f.e - f.s) * pps - 2), height: L.subs }}>
                {f.words.map((x) => x.w).join(" ")}
              </button>
            ))}
            {!ed.frases.length && <span className="absolute text-[12px] leading-[22px] text-muted" style={{ left: pad }}>Este anuncio no tiene subtítulos para mostrar.</span>}
          </div>

          {/* music */}
          <div className="absolute inset-x-0" style={{ top: top(4), height: L.audio }} onPointerDown={(e) => { if (e.target === e.currentTarget) scrub(e); }}>
            {p.musica ? (
              <button type="button" onClick={() => ed.abrir("audio")} className="absolute top-0 flex items-center gap-1.5 overflow-hidden rounded-md px-2 text-[12px] font-semibold text-ink"
                style={{ left: X(0), width: Math.max(20, total * pps), height: L.audio, background: "linear-gradient(90deg, rgba(25,227,255,.28), rgba(138,92,255,.28))" }}>
                <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40" style={{ backgroundImage: "repeating-linear-gradient(90deg, currentColor 0 2px, transparent 2px 5px)", maskImage: "linear-gradient(transparent 20%, #000 50%, transparent 80%)", WebkitMaskImage: "linear-gradient(transparent 20%, #000 50%, transparent 80%)" }} />
                <span className="relative flex min-w-0 items-center gap-1.5 rounded bg-surface/85 px-1.5 py-0.5"><Icon name="music" className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{p.musica.nombre} · {p.musica.vol}%</span></span>
              </button>
            ) : (
              <button type="button" onClick={() => ed.abrir("audio")} className="absolute flex items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 text-[12px] font-semibold text-muted hover:text-ink"
                style={{ left: pad, height: L.audio, width: Math.min(240, Math.max(150, total * pps)) }}>
                <Icon name="plus" className="h-3.5 w-3.5" />Agregar música
              </button>
            )}
          </div>

          {/* playhead (desktop: moves; you can grab it) */}
          {!centered && (
            <div className="absolute top-0 z-30 -translate-x-1/2 cursor-ew-resize" style={{ left: X(t), height }} onPointerDown={scrub}>
              <span className="absolute top-0 left-1/2 h-3.5 w-3 -translate-x-1/2 rounded-b-[5px] rounded-t-sm bg-ink shadow" />
              <span className="absolute top-0 bottom-0 left-1/2 w-[2px] -translate-x-1/2 bg-ink shadow-[0_0_4px_rgba(0,0,0,.35)]" />
              <span className="absolute top-0 bottom-0 -left-2 w-4" />
            </div>
          )}
        </div>
      </div>
      {/* playhead (phone: fixed in the middle) */}
      {centered && (
        <div className="pointer-events-none absolute top-0 bottom-0 left-1/2 z-30 -translate-x-1/2">
          <span className="absolute top-0 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-ink" />
          <span className="absolute top-0 bottom-0 left-1/2 w-[2px] -translate-x-1/2 bg-ink shadow-[0_0_4px_rgba(0,0,0,.35)]" />
        </div>
      )}
    </div>
  );
}

/** The frames of a cut, side by side (like any pro editor). Falls back to one live frame if the clip can't be read. */
function Tira({ ed, clipId, a, wd, h, pps, url }: { ed: Ed; clipId: string; a: number; wd: number; h: number; pps: number; url?: string }) {
  const s = ed.strips[clipId];
  if (!s || s === "x") {
    return url ? <video src={`${url}#t=${(a + 0.05).toFixed(2)}`} muted playsInline preload="metadata" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-80" /> : null;
  }
  const tw = Math.max(18, h * s.ar);
  const n = Math.ceil(wd / tw);
  return (
    <span className="pointer-events-none absolute inset-0 flex">
      {Array.from({ length: Math.min(n, 400) }, (_, k) => {
        const at = a + (k * tw + tw / 2) / pps;
        const f = s.frames[Math.max(0, Math.min(s.frames.length - 1, Math.round(at / s.step)))];
        return <span key={k} className="h-full shrink-0 bg-cover bg-center" style={{ width: tw, backgroundImage: f ? `url(${f})` : undefined }} />;
      })}
    </span>
  );
}
