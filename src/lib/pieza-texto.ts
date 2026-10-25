import { type Diseno, type FormatoPieza, TAMANO, ZONAS, contraste } from "./control-imagen";
import { type Metricas, ancho, metricas } from "./fuente-metricas";

// The headline, the button and the logo slot of an ad image, laid out BY CODE inside the safe zone of each
// format (4:5 feed, 9:16 stories with Meta's top/bottom UI kept clear, 1:1), then written as an ASS file that
// FFmpeg/libass burns on the clean picture. The words are exactly what the customer typed: the AI never draws
// them. Font size auto-fits the box (measured with the font's real advances), lines wrap by words, *words*
// between asterisks get the highlight colour, the button is a pill.

/** One word as printed (`t`), with its highlighted and plain parts («*verdad*,» → «verdad» on, «,» off). */
export interface Palabra { t: string; partes: { t: string; h: boolean }[] }
export interface Linea { palabras: Palabra[]; w: number; cx: number; cy: number }
export interface Caja { x: number; y: number; w: number; h: number }
export interface Layout {
  W: number; H: number;
  zona: Caja;
  titular: { lineas: Linea[]; size: number; lineH: number; caja: Caja; cabe: boolean } | null;
  cta: { texto: string; size: number; caja: Caja } | null;
  logo: Caja | null;
}

/** «Ahorra *50%* hoy» → words with their highlight flag (asterisks are markup, never printed). */
export function palabras(titular: string): Palabra[] {
  const out: Palabra[] = [];
  let on = false;
  // spaces decide the words (exactly as typed); asterisks only switch the highlight on and off
  for (const raw of titular.split(/\s+/).filter(Boolean)) {
    const partes: Palabra["partes"] = [];
    for (const bit of raw.split(/(\*)/)) {
      if (bit === "*") { on = !on; continue; }
      if (bit) partes.push({ t: bit, h: on });
    }
    if (partes.length) out.push({ t: partes.map((p) => p.t).join(""), partes });
  }
  return out;
}

const lineWidth = (m: Metricas, ws: Palabra[], size: number) => ancho(m, ws.map((w) => w.t).join(" "), size);

/** Greedy word wrap at `size`; null when a single word is wider than the box. */
export function envolver(m: Metricas, ws: Palabra[], size: number, maxW: number): Palabra[][] | null {
  const lines: Palabra[][] = [];
  let cur: Palabra[] = [];
  for (const w of ws) {
    if (ancho(m, w.t, size) > maxW) return null;
    const next = [...cur, w];
    if (cur.length && lineWidth(m, next, size) > maxW) { lines.push(cur); cur = [w]; }
    else cur = next;
  }
  if (cur.length) lines.push(cur);
  return lines;
}

/** Same number of lines, but as even as possible («Tu mañana, / más simple», not «Tu mañana, más / simple»). */
export function equilibrar(m: Metricas, ws: Palabra[], size: number, maxW: number, lines: Palabra[][]) {
  if (lines.length < 2) return lines;
  let lo = maxW / lines.length, hi = maxW, best = lines;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    const l = envolver(m, ws, size, mid);
    if (l && l.length <= lines.length) { best = l; hi = mid; } else lo = mid;
  }
  return best;
}

/**
 * Biggest size (from `max` down to `min`) at which the words fit `box` in ≤ `maxLines` lines.
 * If nothing fits even at `min`, returns the `min` wrap with `cabe: false` (never cuts or changes a word).
 */
export function ajustar(m: Metricas, ws: Palabra[], box: { w: number; h: number }, o: { max: number; min: number; maxLines: number; lineF: number; padX: number }) {
  for (let size = Math.floor(o.max); size >= Math.ceil(o.min); size -= 2) {
    const maxW = box.w - 2 * o.padX * size;
    const lines = envolver(m, ws, size, maxW);
    if (!lines || lines.length > o.maxLines) continue;
    if (lines.length * size * o.lineF <= box.h) return { size, lines: equilibrar(m, ws, size, maxW, lines), cabe: true };
  }
  const size = Math.ceil(o.min);
  const lines = envolver(m, ws, size, box.w - 2 * o.padX * size) ?? [ws];
  return { size, lines, cabe: false };
}

/** Where everything goes in format `f`. */
export function layoutPieza(d: Diseno, f: FormatoPieza): Layout {
  const [W, H] = TAMANO[f];
  const z = ZONAS[f];
  const zona: Caja = { x: Math.round(z.x0 * W), y: Math.round(z.y0 * H), w: Math.round((z.x1 - z.x0) * W), h: Math.round((z.y1 - z.y0) * H) };
  const gap = Math.round(W * 0.025);
  let top = zona.y, bottom = zona.y + zona.h;

  // logo slot (the logo is scaled to fit inside it, keeping its shape)
  let logo: Caja | null = null;
  if (d.logo && d.logoPos !== "no") {
    const lw = Math.round(W * (f === "9:16" ? 0.22 : 0.2)), lh = Math.round(Math.min(H * 0.09, W * 0.11));
    if (d.logoPos === "abajo") { logo = { x: Math.round(W / 2 - lw / 2), y: bottom - lh, w: lw, h: lh }; bottom -= lh + gap; }
    else { logo = { x: d.logoPos === "arriba-izq" ? zona.x : zona.x + zona.w - lw, y: top, w: lw, h: lh }; top += lh + gap; }
  }

  // button (pill): at the bottom of the zone (above a bottom logo)
  let cta: Layout["cta"] = null;
  const fuenteCta = metricas(d.fuente);
  if (d.cta.trim()) {
    const ph = Math.round(W * 0.11);
    let size = Math.round(ph * 0.48);
    const maxW = zona.w * 0.8;
    while (size > ph * 0.28 && ancho(fuenteCta, d.cta, size) + ph * 1.1 > maxW) size -= 1;
    const pw = Math.min(maxW, Math.round(ancho(fuenteCta, d.cta, size) + ph * 1.1));
    cta = { texto: d.cta, size, caja: { x: Math.round(W / 2 - pw / 2), y: bottom - ph, w: Math.round(pw), h: ph } };
    bottom -= ph + gap * 1.4;
  }

  // headline box: a band at the top of what's left, or at the bottom
  let titular: Layout["titular"] = null;
  const ws = palabras(d.titular);
  if (ws.length) {
    const bandH = Math.round(Math.min(bottom - top, zona.h * (f === "9:16" ? 0.34 : 0.32) * Math.max(1, d.tam)));
    const caja: Caja = d.posicion === "abajo" ? { x: zona.x, y: Math.round(bottom - bandH), w: zona.w, h: bandH } : { x: zona.x, y: top, w: zona.w, h: bandH };
    const m = metricas(d.fuente);
    const lineF = d.caja ? 1.32 : 1.1, padX = d.caja ? 0.35 : 0;
    const fit = ajustar(m, ws, caja, { max: W * 0.115 * d.tam, min: W * 0.04, maxLines: 4, lineF, padX });
    const lineH = Math.round(fit.size * lineF);
    const total = fit.lines.length * lineH;
    // top band: text hugs the top; bottom band: text hugs the bottom (close to the button)
    const y0 = d.posicion === "abajo" ? caja.y + caja.h - total : caja.y;
    const lineas = fit.lines.map((l, i) => ({ palabras: l, w: Math.round(lineWidth(m, l, fit.size)), cx: Math.round(W / 2), cy: Math.round(y0 + lineH * i + lineH / 2) }));
    titular = { lineas, size: fit.size, lineH, caja, cabe: fit.cabe };
  }
  return { W, H, zona, titular, cta, logo };
}

// ---------- ASS ----------

/** #RRGGBB → ASS &HBBGGRR& */
const c = (h: string) => `&H${h.slice(5, 7)}${h.slice(3, 5)}${h.slice(1, 3)}&`.toUpperCase();
const t0 = "0:00:00.00", t1 = "0:00:10.00";
const n = (v: number) => Math.round(v);

/** A rounded rectangle as an ASS drawing (absolute pixels with \an7\pos(0,0)). */
export function rrect(x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  const [a, b, x2, y2] = [n(x), n(y), n(x + w), n(y + h)];
  const k = n(r);
  return `m ${a + k} ${b} l ${x2 - k} ${b} b ${x2} ${b} ${x2} ${b} ${x2} ${b + k} l ${x2} ${y2 - k} b ${x2} ${y2} ${x2} ${y2} ${x2 - k} ${y2} l ${a + k} ${y2} b ${a} ${y2} ${a} ${y2} ${a} ${y2 - k} l ${a} ${b + k} b ${a} ${b} ${a} ${b} ${a + k} ${b}`;
}
const draw = (layer: number, color: string, shape: string, extra = "") => `Dialogue: ${layer},${t0},${t1},D,,0,0,0,,{\\an7\\pos(0,0)\\bord0\\shad0\\1c${c(color)}${extra}\\p1}${shape}{\\p0}`;

/** The overlay of one format as an ASS script (the picture is `W`×`H`). */
export function assPieza(d: Diseno, L: Layout) {
  const ev: string[] = [];
  const m = metricas(d.fuente);
  if (L.titular) {
    const { size, lineH, lineas } = L.titular;
    const texto = d.colorTexto || (d.caja ? contraste(d.fondoCaja) : "#FFFFFF");
    const padX = Math.round(size * 0.35), padY = Math.round((lineH - size) / 2);
    if (!d.caja) {
      // soft dark scrim behind the text so it reads on any picture
      const top = Math.min(...lineas.map((l) => l.cy)) - lineH, bottom = Math.max(...lineas.map((l) => l.cy)) + lineH;
      ev.push(draw(0, "#000000", rrect(0, top, L.W, bottom - top, 0), `\\1a&H8C&\\blur${n(lineH * 0.6)}`));
    }
    for (const l of lineas) {
      const x0 = l.cx - l.w / 2;
      if (d.caja) ev.push(draw(1, d.fondoCaja, rrect(x0 - padX, l.cy - lineH / 2 + padY * 0.25, l.w + 2 * padX, lineH - padY * 0.5, size * 0.18)));
      // highlighted words: a box in the highlight colour (on boxes) or the text in that colour (on shadow)
      let x = x0;
      const parts: string[] = [];
      l.palabras.forEach((w, i) => {
        if (i) { parts.push(" "); x += ancho(m, " ", size); }
        for (const p of w.partes) {
          const pw = ancho(m, p.t, size);
          if (p.h && d.caja) ev.push(draw(2, d.resaltar, rrect(x - size * 0.12, l.cy - size * 0.55, pw + size * 0.24, size * 1.1, size * 0.14)));
          const col = p.h ? (d.caja ? contraste(d.resaltar) : d.resaltar) : texto;
          parts.push(`{\\1c${c(col)}}${p.t}`);
          x += pw;
        }
      });
      const edge = d.caja ? "\\bord0\\shad0" : `\\bord${Math.max(2, n(size * 0.05))}\\3c&H000000&\\3a&H40&\\shad${Math.max(1, n(size * 0.04))}\\4a&H60&`;
      ev.push(`Dialogue: 3,${t0},${t1},T,,0,0,0,,{\\an5\\pos(${n(l.cx)},${n(l.cy)})\\fn${d.fuente}\\fs${size}${edge}}${parts.join("")}`);
    }
  }
  if (L.cta) {
    const b = L.cta.caja;
    ev.push(draw(4, "#000000", rrect(b.x, b.y + n(b.h * 0.08), b.w, b.h, b.h / 2), `\\1a&HA0&\\blur${n(b.h * 0.15)}`));
    ev.push(draw(5, d.colorBoton, rrect(b.x, b.y, b.w, b.h, b.h / 2)));
    ev.push(`Dialogue: 6,${t0},${t1},T,,0,0,0,,{\\an5\\pos(${n(b.x + b.w / 2)},${n(b.y + b.h / 2)})\\fn${d.fuente}\\fs${L.cta.size}\\bord0\\shad0\\1c${c(contraste(d.colorBoton))}}${L.cta.texto}`);
  }
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${L.W}
PlayResY: ${L.H}
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: T,${d.fuente},48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: D,${d.fuente},20,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${ev.join("\n")}
`;
}
