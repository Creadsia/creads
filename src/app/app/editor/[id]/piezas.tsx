"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { Corte, Formato, Proyecto, Texto } from "@/lib/editor-tipos";
import { type CaptionStyle, fontOf, fontPx, marginPx, shapeWord } from "@/lib/caption-style";
import type { Word } from "@/lib/textmatch";

// Shared pieces of the video editor: data shapes, the editor "API" handed to panels and timeline, icons and
// small controls. The chrome follows the app theme (light or dark); the preview canvas is always dark.

export interface Clip { id: string; idx: number; texto: string; url: string; palabras: Word[] }
export interface Datos { titulo: string; aspecto: string; final: string | null; cortes: Clip[]; proyecto: Proyecto | null; musica: string | null; subtitulosEstilo?: unknown }
export type Sel = { tipo: "corte" | "texto"; i: number } | null;
export type Tool = "cortes" | "texto" | "subtitulos" | "audio" | "formato" | "velocidad";
export interface Strip { step: number; frames: string[]; ar: number }
export interface Frase { s: number; e: number; words: Word[] }

/** `desc`: one short line shown under the panel title and as the rail tooltip, so each tool reads at a glance. */
export const TOOLS: { id: Tool; label: string; icon: string; desc: string }[] = [
  { id: "cortes", label: "Cortes", icon: "film", desc: "Recorta, ordena y arma los clips de tu video." },
  { id: "texto", label: "Texto", icon: "text", desc: "Pon títulos, ofertas y llamados sobre el video." },
  { id: "subtitulos", label: "Subtítulos", icon: "cc", desc: "Estilo, color y posición de los subtítulos." },
  { id: "audio", label: "Audio", icon: "music", desc: "Volumen de la voz y música de fondo." },
  { id: "velocidad", label: "Velocidad", icon: "gauge", desc: "Acelera todo el video sin perder el sonido." },
  { id: "formato", label: "Formato", icon: "crop", desc: "Tamaño para Reels, Feed o cuadrado." },
];

/** Everything the panels and the timeline need from the editor. */
export interface Ed {
  d: Datos; p: Proyecto; t: number; total: number; starts: number[]; durs: Record<string, number>;
  playing: boolean; sel: Sel; setSel: (s: Sel) => void; tool: Tool;
  /** opens a tool (on phones, its sheet) */ abrir: (t: Tool) => void;
  /** shows a tool in the panel without opening the phone sheet (selecting on the timeline) */ setTool: (t: Tool) => void;
  cambiar: (fn: (x: Proyecto) => Proyecto) => void;
  /** a drag: one undo step for the whole gesture; returns the function that applies each move */
  gesto: () => (fn: (x: Proyecto) => Proyecto) => void;
  setCorte: (i: number, patch: Partial<Corte>) => void;
  setTexto: (i: number, patch: Partial<Texto>) => void;
  buscar: (t: number, play?: boolean) => void; pausar: () => void; setT: (t: number) => void;
  clipOf: (id: string) => Clip | undefined; strips: Record<string, Strip | "x">;
  frases: Frase[]; estiloSub: CaptionStyle; setEstiloSub: (patch: Partial<CaptionStyle>) => void;
  dividir: () => void; duplicar: () => void; borrar: () => void; mover: (i: number, dir: -1 | 1) => void;
  moverA: (from: number, to: number) => void;
  nuevoTexto: (preset: Partial<Texto>) => void; agregarCorte: (clipId: string) => void;
  musicaUrl: string | null; subirMusica: (f: File | undefined) => void; musicaOn: (on: boolean) => void;
  ultimaMusica: Proyecto["musica"]; setMusicaVol: (v: number) => void;
  setVelocidad: (v: number) => void;
}

export const len = (c: Corte) => Math.max(0.3, c.b - c.a);
/** 0:03.2 */
export const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`;
/** 0:05 on the ruler */
export const fmtRegla = (s: number, fino: boolean) => (fino ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`);
export const RATIO: Record<Formato, number> = { "9:16": 9 / 16, "4:5": 4 / 5, "1:1": 1 };
export const FRAME: Record<Formato, [number, number]> = { "9:16": [1080, 1920], "4:5": [1080, 1350], "1:1": [1080, 1080] };
export const FORMATO_INFO: Record<Formato, { name: string; use: string }> = {
  "9:16": { name: "Vertical", use: "Reels, Stories y TikTok" },
  "4:5": { name: "Feed", use: "Publicaciones de Instagram y Facebook" },
  "1:1": { name: "Cuadrado", use: "Feed y anuncios de catálogo" },
};
export const COLORES = ["#FFFFFF", "#000000", "#FFE600", "#FF2BD6", "#8A5CFF", "#19E3FF", "#22C55E", "#EF4444", "#FF8A00"];
export const ANIM_NOMBRE: Record<Texto["animacion"], string> = { ninguna: "Sin animación", aparecer: "Aparecer", pop: "Pop", subir: "Subir" };
/** Selection colour on the preview (always on a dark canvas). */
export const SELECT = "#19E3FF";
/** Selection colour on the editor chrome: follows the app theme (darker cyan on light, brand cyan on dark). */
export const SEL = "var(--sel)";

// ---------------------------------------------------------------- icons

const PATHS: Record<string, string> = {
  back: "M15 18l-6-6 6-6",
  undo: "M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11",
  redo: "M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13",
  scissors: "M6 7a2.5 2.5 0 1 0 0-.01M6 17a2.5 2.5 0 1 0 0 .01M8 8.5 20 18M8 15.5 20 6",
  copy: "M8 8h11v11H8zM5 16V5h11",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  film: "M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M16 9.5h4M4 14.5h4M16 14.5h4",
  text: "M5 7V5h14v2M12 5v14M9 19h6",
  cc: "M3 5h18v14H3zM10.5 10a2.5 2.5 0 1 0 0 4M17.5 10a2.5 2.5 0 1 0 0 4",
  music: "M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  crop: "M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
  check: "M5 12.5l4.5 4.5L19 7.5",
  close: "M6 6l12 12M18 6 6 18",
  start: "M6 5v14M18 5 9 12l9 7z",
  end: "M18 5v14M6 5l9 7-9 7z",
  volume: "M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12",
  pen: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4",
  left: "M15 18l-6-6 6-6",
  right: "M9 18l6-6-6-6",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeoff: "M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.1 3.9M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2",
  keys: "M3 6h18v12H3zM7 10h.01M11 10h.01M15 10h.01M7 14h10",
  fit: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  gauge: "M4 18a8 8 0 1 1 16 0M12 14l4-3.5M9 18h6",
  reset: "M4 10a8 8 0 1 1 1 6M4 10V5m0 5h5",
};

export function Icon({ name, className = "h-[18px] w-[18px]", fill = false }: { name: string; className?: string; fill?: boolean }) {
  if (name === "play") return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor" /></svg>;
  if (name === "pause") return <svg viewBox="0 0 24 24" className={className} aria-hidden="true"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" /></svg>;
  return (
    <svg viewBox="0 0 24 24" className={className} fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}

// ---------------------------------------------------------------- small controls

/** Square icon button of the editor chrome (44px on phones, 36px with a mouse). */
export function IconBtn({ icon, label, onClick, disabled, active, className = "" }: { icon: string; label: string; onClick: () => void; disabled?: boolean; active?: boolean; className?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} aria-pressed={active}
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-35 lg:h-9 lg:w-9 ${active ? "bg-surface-2 text-ink" : ""} ${className}`}>
      <Icon name={icon} />
    </button>
  );
}

/** Text + icon button for the timeline toolbar. */
export function ToolBtn({ icon, label, onClick, disabled, kbd }: { icon: string; label: string; onClick: () => void; disabled?: boolean; kbd?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={kbd ? `${label} (${kbd})` : label}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:pointer-events-none disabled:opacity-35">
      <Icon name={icon} className="h-4 w-4" />{label}
    </button>
  );
}

export function Seccion({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold text-muted" style={{ fontFamily: "var(--font-body)" }}>{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, unit = "%", onStart }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; unit?: string; onStart?: () => void }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-baseline justify-between text-[13px]"><span className="font-semibold text-ink">{label}</span><span className="font-mono text-[13px] tabular-nums text-muted">{unit === "s" ? `${value.toFixed(2)} s` : `${Math.round(value)}${unit}`}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onPointerDown={onStart} onChange={(e) => onChange(Number(e.target.value))}
        className="ed-range h-11 w-full cursor-pointer lg:h-6" style={{ "--pct": `${pct}%` } as CSSProperties} />
    </label>
  );
}

export function Switch({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-left">
      <span className="flex flex-col"><span className="text-sm font-semibold text-ink">{label}</span>{hint && <span className="text-[13px] text-muted">{hint}</span>}</span>
      <span className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${on ? "bg-[image:var(--grad)]" : "bg-line"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left] ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

export function Chip({ on, onClick, children, label, style }: { on: boolean; onClick: () => void; children: ReactNode; label?: string; style?: CSSProperties }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} aria-label={label} style={style}
      className={`min-h-11 rounded-lg border px-3 text-[13px] font-semibold transition-colors lg:min-h-9 ${on ? "border-[var(--sel)] bg-[var(--sel)]/10 text-ink" : "border-line bg-surface-2/60 text-muted hover:text-ink"}`}>
      {children}
    </button>
  );
}

/** A clean segmented control: one row of pills, the active one lifted with the brand gradient. */
export function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-xl border border-line bg-surface-2/60 p-1">
      {options.map((o) => {
        const on = o.v === value;
        return (
          <button key={String(o.v)} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.v)}
            className={`min-h-9 flex-1 rounded-lg px-2 text-[13px] font-semibold transition-colors ${on ? "bg-[image:var(--grad)] text-white shadow-[0_4px_14px_-6px_rgba(255,43,214,.9)]" : "text-muted hover:text-ink"}`}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Swatches({ value, onChange, label, none }: { value: string | null; onChange: (c: string | null) => void; label: string; none?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {none && (
        <button type="button" role="radio" aria-checked={value === null} aria-label="Sin fondo" title="Sin fondo" onClick={() => onChange(null)}
          className={`relative grid h-9 w-9 place-items-center overflow-hidden rounded-full border-2 bg-surface-2 lg:h-7 lg:w-7 ${value === null ? "border-[var(--sel)]" : "border-line"}`}>
          <span className="absolute h-[2px] w-[140%] rotate-45 bg-bad" />
        </button>
      )}
      {COLORES.map((c) => (
        <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} title={c} onClick={() => onChange(c)}
          className={`h-9 w-9 rounded-full border-2 lg:h-7 lg:w-7 ${value === c ? "border-[var(--sel)] ring-2 ring-[var(--sel)]/30" : "border-ink/15"}`} style={{ background: c }} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- subtitles look (preview)

/** CSS for one subtitle line, following the ad's caption style (same rules the export uses). */
export function subtituloCss(st: CaptionStyle, formato: Formato, fw: number, fh: number): { box: CSSProperties; word: CSSProperties; accent: CSSProperties } {
  const [W, H] = FRAME[formato];
  const k = fw / W;
  const size = fontPx(st.size, W, H) * k;
  const vertical = H > W;
  const pos: CSSProperties = st.y !== undefined
    ? { left: `${st.x ?? 50}%`, top: `${st.y}%`, transform: "translate(-50%,-50%)" }
    : st.position === "centro" ? { left: "50%", top: "50%", transform: "translate(-50%,-50%)" }
    : st.position === "arriba" ? { left: "50%", top: marginPx("arriba", H, vertical) * (fh / H), transform: "translateX(-50%)" }
    : { left: "50%", bottom: marginPx("abajo", H, vertical) * (fh / H), transform: "translateX(-50%)" };
  const stroke = Math.max(1, size * 0.07);
  // a solid outline of `s` px in colour `c` (eight offsets), the same border the ASS export draws
  const ring = (s: number, c: string) => `${s}px 0 0 ${c},-${s}px 0 0 ${c},0 ${s}px 0 ${c},0 -${s}px 0 ${c},${s}px ${s}px 0 ${c},-${s}px -${s}px 0 ${c},${s}px -${s}px 0 ${c},-${s}px ${s}px 0 ${c}`;
  const outline = `${ring(stroke, "#000")},0 ${stroke * 1.5}px ${stroke * 3}px rgba(0,0,0,.5)`;
  const look = st.look;
  const word: CSSProperties = {
    color: st.color,
    textShadow:
      look === "suave" ? `0 ${size * 0.06}px ${size * 0.25}px rgba(0,0,0,.85)`
        : look === "neon" ? `0 0 ${size * 0.25}px ${st.accent}, 0 0 ${size * 0.5}px ${st.accent}`
          : look === "caja" || look === "etiqueta" || look === "realce" ? "none"
            : look === "grueso" ? `${ring(size * 0.1, "#000")},0 ${size * 0.05}px ${size * 0.18}px rgba(0,0,0,.45)`
              : look === "sombra" ? `${size * 0.045}px ${size * 0.06}px 0 rgba(0,0,0,.95)`
                : look === "borde" ? `${ring(size * 0.07, st.accent)},0 ${size * 0.04}px ${size * 0.12}px rgba(0,0,0,.6)`
                  : look === "limpio" ? `${ring(Math.max(1, size * 0.03), "#000")},0 ${size * 0.03}px ${size * 0.12}px rgba(0,0,0,.4)`
                    : outline,
  };
  const box: CSSProperties = {
    ...pos, position: "absolute", width: "86%", textAlign: "center", fontFamily: `"${fontOf(st.font).ass}", var(--font-display), sans-serif`,
    fontSize: size, lineHeight: 1.15, pointerEvents: "none",
  };
  const accent: CSSProperties = ["resaltar", "salto", "karaoke", "palabra", "realce"].includes(look) ? { color: st.accent } : {};
  return { box, word, accent };
}

/** One subtitle phrase, drawn as the export will (look, colours, the spoken word highlighted). On the preview it
 *  can be made draggable (sets style.x/y) with a visible selection box. */
export function SubtituloLinea({ st, words, now, formato, fw, fh, selected, onPointerDown }: { st: CaptionStyle; words: Word[]; now: number; formato: Formato; fw: number; fh: number; selected?: boolean; onPointerDown?: (e: ReactPointerEvent) => void }) {
  const { box, word, accent } = subtituloCss(st, formato, fw, fh);
  const boxed = st.look === "caja" || st.look === "etiqueta" || st.look === "realce";
  const bg = st.look === "etiqueta" ? st.accent : "rgba(0,0,0,.72)";
  const interactive = Boolean(onPointerDown);
  return (
    <span style={{ ...box, ...(interactive ? { pointerEvents: "auto", cursor: "move", outline: selected ? `1.5px solid ${SELECT}` : undefined, outlineOffset: 6, borderRadius: 4 } : null) }} aria-hidden="true" onPointerDown={onPointerDown}>
      <span style={boxed ? { background: bg, padding: "0.08em 0.3em", borderRadius: "0.18em", boxDecorationBreak: "clone", WebkitBoxDecorationBreak: "clone" } : undefined}>
        {words.map((w, i) => {
          const on = now >= w.s && now < w.e + 0.05;
          return <span key={i} style={{ ...word, ...(on ? accent : {}) }}>{shapeWord(w.w, st)}{i < words.length - 1 ? " " : ""}</span>;
        })}
      </span>
    </span>
  );
}

// ---------------------------------------------------------------- text presets

export const PRESETS: { id: string; name: string; texto: string; style: Partial<Texto> }[] = [
  { id: "titulo", name: "Título", texto: "TU TÍTULO AQUÍ", style: { fuente: "Anton", tam: 10, color: "#FFFFFF", fondo: null, animacion: "pop", y: 18 } },
  { id: "subtitulo", name: "Texto simple", texto: "Escribe tu texto", style: { fuente: "Montserrat ExtraBold", tam: 6, color: "#FFFFFF", fondo: null, animacion: "aparecer", y: 30 } },
  { id: "oferta", name: "Oferta", texto: "-30% HOY", style: { fuente: "Archivo Black", tam: 9, color: "#000000", fondo: "#FFE600", animacion: "pop", y: 22 } },
  { id: "cta", name: "Llamado a la acción", texto: "Escríbenos hoy", style: { fuente: "Poppins ExtraBold", tam: 6.5, color: "#FFFFFF", fondo: "#FF2BD6", animacion: "subir", y: 70 } },
  { id: "etiqueta", name: "Etiqueta", texto: "NUEVO", style: { fuente: "Inter Black", tam: 5, color: "#000000", fondo: "#FFFFFF", animacion: "aparecer", y: 12 } },
  { id: "pregunta", name: "Pregunta gancho", texto: "¿Sabías esto?", style: { fuente: "Bebas Neue", tam: 11, color: "#FFE600", fondo: null, animacion: "subir", y: 40 } },
];
