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
export interface Proyecto {
  cortes: Corte[]; textos: Texto[];
  subtitulos: boolean;
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

