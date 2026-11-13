// The editor's shapes and options, shared by the browser (editor screen) and the server (export).

export const FORMATOS = ["9:16", "4:5", "1:1"] as const;
export type Formato = (typeof FORMATOS)[number];
export const FUENTES = ["Montserrat ExtraBold", "Anton", "Bebas Neue", "Poppins ExtraBold", "Archivo Black", "Inter Black"] as const;
export type Fuente = (typeof FUENTES)[number];
export const ANIMACIONES = ["ninguna", "aparecer", "pop", "subir"] as const;

export interface Corte { clipId: string; a: number; b: number }
export interface Texto {
  id: string; texto: string; desde: number; hasta: number;
  x: number; y: number;          // centre, 0–100 % of the frame
  tam: number;                   // font size, % of the frame width
  color: string; fondo: string | null; fuente: Fuente; animacion: (typeof ANIMACIONES)[number];
}
/** Longest time (seconds) a cut, text or overlay may reach. Generous so the editor isn't capped at a couple of
 *  minutes (owner, 12 Nov 2026: «videos de más de 2 minutos»). The real ceiling is the export render time. */
export const MAX_SEG = 1800;

export const MEDIO_TIPOS = ["video", "imagen"] as const;
export type MedioTipo = (typeof MEDIO_TIPOS)[number];
/** A video or image laid ON TOP of the cut (picture-in-picture, «como VEED»): placed, sized and faded by the
 *  user, shown over a time window. The overlay is silent (visual only) so the ad's own voice and music are
 *  untouched. `url` is a file of the user's own workspace (uploaded in the editor or an image from Creads). */
export interface Medio {
  id: string; url: string; tipo: MedioTipo;
  desde: number; hasta: number;  // when it's on screen, on the edited (pre-speed) timeline, in seconds
  x: number; y: number;          // centre, 0–100 % of the frame
  w: number;                     // width, 5–100 % of the frame width (height follows the media's own ratio)
  opacidad: number;              // 1–100 %
  a: number;                     // video only: where it starts inside the source file (seconds)
}
/** The base (background) layer zoomed in and panned, so the user can resize/move «la que está primero» too.
 *  `escala` 1 = untouched; `x`/`y` are the centre of what stays visible, 0–100 % (50 = centred). */
export interface BaseTransform { escala: number; x: number; y: number }

export interface Proyecto {
  cortes: Corte[]; textos: Texto[];
  /** Videos/images laid on top (picture-in-picture). Optional and additive: an ad without it exports exactly
   *  as before. */
  medios?: Medio[];
  /** Zoom/pan of the background layer. Optional; absent or escala 1 leaves the base untouched. */
  base?: BaseTransform;
  subtitulos: boolean;
  /** Subtitle word fixes (spelling), edited right in the editor. Key «clipId:wordIndex» → the corrected word
   *  (its index within that clip's transcript, so it follows the clip when cuts are reordered or trimmed, and
   *  the preview and the export agree). An empty value means «hide this word». */
  subCorr?: Record<string, string>;
  musica: { url: string; nombre: string; vol: number } | null;
  vozVol: number;                // 0–150 %
  formato: Formato;
  velocidad: number;             // playback speed, 0.5–2.0 (1 = normal)
}

/** Playback speed presets offered in the editor (whole video). `velocidad` is clamped to [0.5, 2]. */
export const VELOCIDADES = [1, 1.1, 1.2, 1.5, 2] as const;

// ---------------------------------------------------------------- playback speed (pure, shared by browser + export)
/** The video's speed, made safe: a number in [0.5, 2] (1 = normal). atempo renders this range in one step. */
export function clampVelocidad(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(2, Math.max(0.5, Math.round(n * 100) / 100)) : 1;
}
/** A source-time second mapped onto the sped-up output timeline (t → t / velocidad). */
export const escalar = (segundos: number, velocidad: number): number => segundos / (velocidad || 1);
/** Subtitle word timings moved onto the sped-up timeline (so they stay in sync after ffmpeg setpts). */
export const escalarPalabras = <T extends { s: number; e: number }>(words: T[], velocidad: number): T[] =>
  velocidad === 1 ? words : words.map((w) => ({ ...w, s: escalar(w.s, velocidad), e: escalar(w.e, velocidad) }));
/** On-screen texts moved onto the sped-up timeline. */
export const escalarTextos = <T extends { desde: number; hasta: number }>(textos: T[], velocidad: number): T[] =>
  velocidad === 1 ? textos : textos.map((t) => ({ ...t, desde: escalar(t.desde, velocidad), hasta: escalar(t.hasta, velocidad) }));
/** Overlay media windows moved onto the sped-up timeline (same mapping as the texts). */
export const escalarMedios = <T extends { desde: number; hasta: number }>(medios: T[], velocidad: number): T[] =>
  velocidad === 1 ? medios : medios.map((m) => ({ ...m, desde: escalar(m.desde, velocidad), hasta: escalar(m.hasta, velocidad) }));
/** The background zoom/pan, made safe. Returns null when it leaves the base untouched (so the export skips it). */
export function clampBase(v: unknown): BaseTransform | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = (x: unknown, lo: number, hi: number, d: number) => { const k = Number(x); return Number.isFinite(k) ? Math.min(hi, Math.max(lo, k)) : d; };
  const escala = Math.round(n(o.escala, 1, 3, 1) * 100) / 100;
  const x = Math.round(n(o.x, 0, 100, 50)), y = Math.round(n(o.y, 0, 100, 50));
  if (escala <= 1.001) return null; // no zoom = nothing to pan = leave the base as it is
  return { escala, x, y };
}

