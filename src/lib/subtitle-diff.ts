// «Editar subtítulos» in the library: the customer edits the subtitle lines as text; this turns each edited
// line into the word corrections the montage applies (same timing, nothing generated again).

import type { Correccion } from "./montage";

export interface Cue { n: number; desde: string; hasta: string; texto: string }

/** The cues of an .srt file (number, times, text). */
export function parseSrt(srt: string): Cue[] {
  return srt.replace(/\r/g, "").split(/\n{2,}/).map((block) => {
    const lines = block.trim().split("\n");
    const m = (lines[1] ?? "").match(/^(\S+)\s*-->\s*(\S+)/);
    if (!m) return null;
    return { n: Number(lines[0]) || 0, desde: m[1], hasta: m[2], texto: lines.slice(2).join(" ").trim() };
  }).filter((c): c is Cue => Boolean(c && c.texto));
}

const toks = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const bare = (w: string) => w.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

/**
 * What changed in one line, as corrections («de» = up to 4 words as they appear, «a» = how they should read).
 * A line with the same number of words is corrected word by word; otherwise the changed stretch must be at
 * most 4 words long (the montage matches 1–4 heard words). Returns an error text when the change is too big.
 */
export function cueFixes(before: string, after: string): Correccion[] | { error: string } {
  const a = toks(before), b = toks(after);
  let p = 0;
  while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let q = 0;
  while (q < a.length - p && q < b.length - p && a[a.length - 1 - q] === b[b.length - 1 - q]) q++;
  let from = p, to = a.length - q, nFrom = p, nTo = b.length - q;
  if (from === to && nFrom === nTo) return [];
  if (from === to) {
    // only words added: anchor them to a neighbour word so there is something to find
    if (from > 0) { from--; nFrom--; } else if (to < a.length) { to++; nTo++; } else return { error: "No se puede agregar texto a una línea vacía." };
  }
  const old = a.slice(from, to), neu = b.slice(nFrom, nTo);
  if (old.length === neu.length && old.length > 1) {
    return old.map((w, i) => ({ de: w, a: neu[i] })).filter((x) => x.de !== x.a && bare(x.de));
  }
  if (old.length > 4) return { error: "Cambia como máximo 4 palabras seguidas por línea (o la misma cantidad de palabras)." };
  if (!old.some((w) => bare(w))) return { error: "Esa parte no tiene palabras que se puedan cambiar." };
  return [{ de: old.join(" "), a: neu.join(" ") }];
}
