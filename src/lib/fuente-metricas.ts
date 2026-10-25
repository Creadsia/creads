import { readFileSync } from "node:fs";
import path from "node:path";

// Exact text widths from the brand fonts in assets/fonts (no canvas, no native module): reads the TrueType
// tables the way libass does (cmap for the glyphs, hmtx for the advances, OS/2 win ascent+descent for the
// size), so the headline overlay can auto-fit and wrap BEFORE FFmpeg draws it. Kerning is ignored (a few
// pixels per line at most; the layout keeps a margin for it).

export interface Metricas {
  /** Font name as libass looks it up (the `Fontname` of the ASS style). */
  nombre: string;
  /** advance of a code point, in font units (undefined when the font has no glyph for it) */
  avance(cp: number): number | undefined;
  /** units that make up one ASS font size unit (usWinAscent + usWinDescent, like VSFilter/libass) */
  alto: number;
  ascent: number;
  descent: number;
}

function parse(buf: Buffer, nombre: string): Metricas {
  const numTables = buf.readUInt16BE(4);
  const tables: Record<string, number> = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    tables[buf.toString("latin1", o, o + 4)] = buf.readUInt32BE(o + 8);
  }
  for (const t of ["hhea", "hmtx", "cmap"]) if (tables[t] == null) throw new Error(`Fuente sin tabla ${t}: ${nombre}`);
  const hheaAsc = buf.readInt16BE(tables.hhea + 4), hheaDesc = buf.readInt16BE(tables.hhea + 6);
  const nH = buf.readUInt16BE(tables.hhea + 34);
  let ascent = hheaAsc, descent = -hheaDesc;
  if (tables["OS/2"] != null) {
    const wa = buf.readInt16BE(tables["OS/2"] + 74), wd = buf.readInt16BE(tables["OS/2"] + 76);
    if (wa + wd !== 0) { ascent = wa; descent = wd; }
  }
  const advOf = (g: number) => buf.readUInt16BE(tables.hmtx + Math.min(g, nH - 1) * 4);

  // cmap: prefer format 12 (full Unicode), else format 4 (BMP)
  const cmap = tables.cmap, n = buf.readUInt16BE(cmap + 2);
  let f4 = -1, f12 = -1;
  for (let i = 0; i < n; i++) {
    const pid = buf.readUInt16BE(cmap + 4 + i * 8), eid = buf.readUInt16BE(cmap + 6 + i * 8);
    const off = cmap + buf.readUInt32BE(cmap + 8 + i * 8);
    const fmt = buf.readUInt16BE(off);
    if (fmt === 12 && (pid === 3 || pid === 0)) f12 = off;
    if (fmt === 4 && ((pid === 3 && eid === 1) || pid === 0)) f4 = off;
  }
  const cache = new Map<number, number>();
  function glyph(cp: number): number {
    if (f12 >= 0) {
      const groups = buf.readUInt32BE(f12 + 12);
      for (let i = 0; i < groups; i++) {
        const o = f12 + 16 + i * 12;
        const a = buf.readUInt32BE(o), b = buf.readUInt32BE(o + 4);
        if (cp >= a && cp <= b) return buf.readUInt32BE(o + 8) + (cp - a);
      }
      return 0;
    }
    if (f4 < 0 || cp > 0xffff) return 0;
    const segX2 = buf.readUInt16BE(f4 + 6);
    const ends = f4 + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let i = 0; i < segX2 / 2; i++) {
      const end = buf.readUInt16BE(ends + i * 2);
      if (cp > end) continue;
      const start = buf.readUInt16BE(starts + i * 2);
      if (cp < start) return 0;
      const delta = buf.readInt16BE(deltas + i * 2), ro = buf.readUInt16BE(ranges + i * 2);
      if (!ro) return (cp + delta) & 0xffff;
      const g = buf.readUInt16BE(ranges + i * 2 + ro + (cp - start) * 2);
      return g ? (g + delta) & 0xffff : 0;
    }
    return 0;
  }
  return {
    nombre,
    alto: ascent + descent,
    ascent,
    descent,
    avance(cp) {
      if (cache.has(cp)) return cache.get(cp);
      const g = glyph(cp);
      const v = g ? advOf(g) : undefined;
      if (v !== undefined) cache.set(cp, v);
      return v;
    },
  };
}

/** The fonts of the overlay: the ASS name and its file in assets/fonts. */
export const FUENTES_PIEZA = {
  "Montserrat ExtraBold": "Montserrat-ExtraBold.ttf",
  "Poppins ExtraBold": "Poppins-ExtraBold.ttf",
  "Archivo Black": "ArchivoBlack-Regular.ttf",
  "Anton": "Anton-Regular.ttf",
  "Inter Black": "Inter-Black.ttf",
} as const;
export type FuentePieza = keyof typeof FUENTES_PIEZA;

export const FONTS_DIR = path.join(process.cwd(), "assets", "fonts");
const loaded = new Map<string, Metricas>();
export function metricas(f: FuentePieza): Metricas {
  const hit = loaded.get(f);
  if (hit) return hit;
  const m = parse(readFileSync(path.join(FONTS_DIR, FUENTES_PIEZA[f])), f);
  loaded.set(f, m);
  return m;
}

/** Width in pixels of `text` at ASS font size `size` (glyphs the font lacks count as an average letter). */
export function ancho(m: Metricas, text: string, size: number) {
  let u = 0;
  const avg = m.avance(0x6f) ?? m.alto * 0.5; // «o»
  for (const ch of text) u += m.avance(ch.codePointAt(0)!) ?? avg;
  return (u / m.alto) * size;
}

/** True if the font draws every character (accents, ñ, ¿¡, €…), so libass won't swap in another font. */
export const cubre = (m: Metricas, text: string) => [...text].every((ch) => /\s/.test(ch) || m.avance(ch.codePointAt(0)!) !== undefined);
