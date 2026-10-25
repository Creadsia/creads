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
}

