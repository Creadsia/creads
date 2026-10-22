// «Demo con presentador» (owner, 22 Oct 2026): the ad that shows what Creads makes. A presenter talks fast
// to the camera while short UGC clips made with Creads (different people showing a product) appear in a split
// screen or full screen with the presenter in a corner, plus a «producto + prompt» card, word-by-word
// captions and a closing card. Like the Arcads ads that work on Meta, made from ads Creads already made.
// Pure FFmpeg on our server: the clips were paid when they were made; putting them together costs nothing.
// Additive: nothing else in the montage changes.

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { captions, ff } from "./montage";
import type { Word } from "./textmatch";
import { DEFAULT_STYLE } from "./caption-style";

export const W = 720, H = 1280, HALF = 640;
const FPS = 30;
export const DEMO_END = 2.2;
const FONTS = path.join(process.cwd(), "assets", "fonts");
const esc = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");

export type SlotKind = "host" | "split" | "pip" | "card";
export interface Slot { a: number; b: number; kind: SlotKind; ex?: number; exAt?: number }

/**
 * Who is on screen when. Opens on a clip (the proof first), then the «producto + prompt» card, then the
 * presenter and the clips take turns (full presenter · clip with the presenter in a corner · clip · split),
 * every clip a different person; the last seconds are the presenter alone (the call to action).
 */
export function planDemo(dur: number, nEx: number, hasCard: boolean, slot = 2.4): Slot[] {
  const out: Slot[] = [];
  if (nEx < 1 || dur < 6) return [{ a: 0, b: dur, kind: "host" }];
  const tail = Math.min(4, Math.max(2.5, dur * 0.12));
  const end = dur - tail;
  const uses = new Array(nEx).fill(0);
  let k = 0;
  const nextEx = () => { const i = k++ % nEx; const at = uses[i]++ * slot; return { ex: i, exAt: at }; };
  let t = 0;
  const push = (kind: SlotKind, len: number) => {
    const b = Math.min(end, t + len);
    if (b - t < 0.8) return;
    out.push({ a: +t.toFixed(3), b: +b.toFixed(3), kind, ...(kind === "split" || kind === "pip" ? nextEx() : {}) });
    t = b;
  };
  push("split", slot);
  if (hasCard) push("card", slot + 0.4);
  const cycle: SlotKind[] = ["host", "pip", "pip", "split"];
  let c = 0;
  while (end - t >= 0.8) push(cycle[c++ % cycle.length], cycle[c % cycle.length] === "host" ? slot * 0.8 : slot);
  if (out.length && end - out[out.length - 1].b > 0.01) out[out.length - 1].b = +end.toFixed(3);
  out.push({ a: +end.toFixed(3), b: +dur.toFixed(3), kind: "host" });
  return out;
}

const cover = (w: number, h: number) => `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},setsar=1`;
const enc = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS)];

/** One slot as a silent 720×1280 clip. `host`: the presenter's video; `ex`: the example clips; `card`: a 720×640 png. */
export async function renderSlot(dir: string, i: number, s: Slot, host: string, ex: { file: string; dur: number }[], card: string | null) {
  const out = path.join(dir, `slot${String(i).padStart(2, "0")}.mp4`);
  const len = (s.b - s.a).toFixed(3);
  const hostIn = ["-ss", s.a.toFixed(3), "-t", len, "-i", host];
  const exIn = () => {
    const e = ex[s.ex ?? 0];
    const room = Math.max(0.1, e.dur - Number(len) - 0.3);
    const at = 0.3 + ((s.exAt ?? 0) % room);
    return ["-stream_loop", "-1", "-ss", at.toFixed(3), "-t", len, "-i", e.file];
  };
  let args: string[];
  if (s.kind === "host" || (s.kind === "card" && !card)) {
    args = [...hostIn, "-vf", `${cover(W, H)},fps=${FPS}`];
  } else if (s.kind === "split") {
    // the clip on top, the presenter's face below (his frame cropped around the face)
    args = [...exIn(), ...hostIn, "-filter_complex", `[0:v]${cover(W, HALF)},fps=${FPS}[t];[1:v]${cover(W, H)},crop=${W}:${HALF}:0:${Math.round(H * 0.16)},fps=${FPS}[b];[t][b]vstack=inputs=2[v]`, "-map", "[v]"];
  } else if (s.kind === "card") {
    args = ["-loop", "1", "-t", len, "-i", card as string, ...hostIn, "-filter_complex", `[0:v]${cover(W, HALF)},fps=${FPS}[t];[1:v]${cover(W, H)},crop=${W}:${HALF}:0:${Math.round(H * 0.16)},fps=${FPS}[b];[t][b]vstack=inputs=2[v]`, "-map", "[v]"];
  } else {
    // the clip full screen, the presenter in a small framed window at the bottom left
    const pw = 228, ph = 300;
    args = [...exIn(), ...hostIn, "-filter_complex", `[0:v]${cover(W, H)},fps=${FPS}[bg];[1:v]${cover(W, H)},scale=${pw}:-2,crop=${pw}:${ph}:0:${Math.round(pw * 16 / 9 * 0.1)},pad=${pw + 8}:${ph + 8}:4:4:white,fps=${FPS}[p];[bg][p]overlay=28:${H - ph - 300}[v]`, "-map", "[v]"];
  }
  await ff(["-y", "-v", "error", ...args, "-t", len, ...enc, out], 120_000);
  return out;
}

/** «Producto + prompt» card (720×640): the product photo, and the words typed in Creads to make the clips. */
const BTN_Y = 400;
export async function renderCard(dir: string, product: string | null, prompt: string) {
  const ass = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${HALF}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Label,Montserrat ExtraBold,24,&H00FFFFFF,&H00FFFFFF,&H00161616,&H00161616,0,0,0,0,100,100,1,0,3,10,0,5,0,0,0,1
Style: Boton,Montserrat ExtraBold,30,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,1,0,1,0,0,5,0,0,0,1
Style: Prompt,Montserrat ExtraBold,30,&H00161616,&H00161616,&H00FFFFFF,&H00FFFFFF,0,0,0,0,100,100,0,0,1,0,0,7,${product ? 380 : 70},50,120,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${product ? `Dialogue: 1,0:00:00.00,0:01:00.00,Label,,0,0,0,,{\\pos(185,585)}PRODUCTO\n` : ""}Dialogue: 1,0:00:00.00,0:01:00.00,Label,,0,0,0,,{\\pos(${product ? 535 : 360},70)}PROMPT
Dialogue: 1,0:00:00.00,0:01:00.00,Boton,,0,0,0,,{\\pos(${product ? 525 : 360},${BTN_Y + 35})}Generar
Dialogue: 1,0:00:00.00,0:01:00.00,Prompt,,0,0,0,,${prompt.replace(/[{}\\\n]/g, " ").slice(0, 160)}
`;
  const assFile = path.join(dir, "card.ass");
  await writeFile(assFile, ass);
  const out = path.join(dir, "card.png");
  const bx = product ? 360 : 50, bw = product ? 330 : 620;
  const box = `drawbox=x=${bx}:y=100:w=${bw}:h=${BTN_Y - 125}:color=white:t=fill,drawbox=x=${bx}:y=${BTN_Y}:w=${bw}:h=70:color=0x161616:t=fill`;
  const draw = `${box},ass=filename='${esc(assFile)}':fontsdir='${esc(FONTS)}'`;
  if (product) {
    await ff(["-y", "-v", "error", "-f", "lavfi", "-i", `color=c=0xEEEEEE:s=${W}x${HALF}`, "-i", product, "-filter_complex",
      `[1:v]scale=300:520:force_original_aspect_ratio=decrease,pad=300:520:(ow-iw)/2:(oh-ih)/2:color=white[p];[0:v][p]overlay=35:40,${draw}[v]`, "-map", "[v]", "-frames:v", "1", out], 60_000);
  } else {
    await ff(["-y", "-v", "error", "-f", "lavfi", "-i", `color=c=0xEEEEEE:s=${W}x${HALF}`, "-vf", draw, "-frames:v", "1", out], 60_000);
  }
  return out;
}

/** The overlay of the whole ad: word-by-word captions on the seam, «Hecho con IA» on every clip, the closing card. */
export function demoAss(words: Word[], slots: Slot[], dur: number, cierre: { titulo: string; linea: string }) {
  const cap = captions(words, W, H, "9:16", { ...DEFAULT_STYLE, look: "palabra", case: "upper", size: 30, x: 50, y: 50, sello: false, script: false }, dur).ass;
  const t2 = (s: number) => {
    const m = Math.floor(s / 60), x = s % 60;
    return `0:${String(m).padStart(2, "0")}:${x.toFixed(2).padStart(5, "0")}`;
  };
  const extra: string[] = [];
  for (const s of slots) {
    if (s.kind === "split" || s.kind === "pip") extra.push(`Dialogue: 2,${t2(s.a)},${t2(s.b)},DemoBadge,,0,0,0,,{\\an9\\pos(${W - 28},${s.kind === "split" ? 28 : 60})}Hecho con IA`);
  }
  const a = dur + 0.25, b = dur + DEMO_END;
  extra.push(`Dialogue: 3,${t2(a)},${t2(b)},DemoFin,,0,0,0,,{\\pos(${W / 2},${Math.round(H * 0.44)})\\fad(250,0)}${cierre.titulo.replace(/[{}\\]/g, "")}`);
  if (cierre.linea) extra.push(`Dialogue: 3,${t2(a + 0.2)},${t2(b)},DemoLinea,,0,0,0,,{\\pos(${W / 2},${Math.round(H * 0.52)})\\fad(250,0)}${cierre.linea.replace(/[{}\\]/g, "")}`);
  const styles = [
    "Style: DemoBadge,Montserrat ExtraBold,22,&H00FFFFFF,&H00FFFFFF,&H90000000,&H90000000,0,0,0,0,100,100,0,0,3,8,0,9,0,0,0,1",
    "Style: DemoFin,Montserrat ExtraBold,78,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1",
    "Style: DemoLinea,Montserrat ExtraBold,38,&H00E6E6E6,&H00E6E6E6,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,60,60,0,1",
  ];
  return cap.replace("\n\n[Events]", `\n${styles.join("\n")}\n\n[Events]`).trimEnd() + "\n" + extra.join("\n") + "\n";
}

/** Joins the slots, adds the presenter's voice, the overlay and a closing card that fades in. */
export async function finishDemo(dir: string, slotFiles: string[], host: string, dur: number, assText: string) {
  const list = path.join(dir, "list.txt");
  await writeFile(list, slotFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  const assFile = path.join(dir, "demo.ass");
  await writeFile(assFile, assText);
  const total = dur + DEMO_END;
  const out = path.join(dir, "demo.mp4");
  await ff(["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list, "-i", host, "-filter_complex",
    `[0:v]tpad=stop_mode=clone:stop_duration=${DEMO_END}[v1];color=c=0x0B0B0F:s=${W}x${H}:r=${FPS}:d=${total.toFixed(3)},format=yuva420p,fade=t=in:st=${dur.toFixed(3)}:d=0.45:alpha=1[eb];[v1][eb]overlay=shortest=1,ass=filename='${esc(assFile)}':fontsdir='${esc(FONTS)}'[vo];[1:a]atrim=0:${dur.toFixed(3)},aresample=44100,apad=whole_dur=${total.toFixed(3)}[ao]`,
    "-map", "[vo]", "-map", "[ao]", "-t", total.toFixed(3), "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out], 240_000);
  return { file: out, seconds: total };
}
