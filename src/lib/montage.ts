import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import type { Word } from "./textmatch";

// Assembles the final ad: trims the silence at the ends of every clip, joins them, and burns TikTok-style
// captions. Ported from the prototype's montage tool (legacy/af.py: trim_points, build, ASS presets).

const run = promisify(execFile);
const FONTS = path.join(process.cwd(), "assets", "fonts");

function ffmpeg() {
  if (!ffmpegPath) throw new Error("FFmpeg no está disponible en el servidor.");
  return ffmpegPath as unknown as string;
}

/** Runs ffmpeg and returns its log (ffmpeg writes everything to stderr). */
async function ff(args: string[], timeoutMs = 240_000) {
  try {
    const r = await run(ffmpeg(), ["-hide_banner", ...args], { maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs });
    return r.stderr + r.stdout;
  } catch (err) {
    const e = err as { stderr?: string; message?: string };
    throw new Error(`FFmpeg: ${(e.stderr || e.message || "falló").slice(-400)}`);
  }
}

/** Quick self-check used by GET /api/montage: is the FFmpeg binary there and does it have captions support? */
export async function selfCheck() {
  const v = await ff(["-version"]).catch((e: Error) => e.message);
  const f = await ff(["-filters"]).catch(() => "");
  return { ffmpeg: v.split("\n")[0].slice(0, 80), captions: /\bass\b/.test(f) };
}

export async function download(url: string, file: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar un corte (${res.status}).`);
  await writeFile(file, Buffer.from(await res.arrayBuffer()));
}

/** Duration and whether the file has sound. */
export async function probe(file: string) {
  const log = await ff(["-i", file, "-f", "null", "-t", "0", "-"]).catch((e: Error) => e.message);
  const m = log.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const dur = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
  return { dur, audio: /Stream #\d+:\d+[^:]*: Audio/.test(log) };
}

/** Where speech starts and ends: skip leading silence and dead air at the end (prototype: trim_points). */
export async function trimPoints(file: string, dur: number) {
  const log = await ff(["-i", file, "-af", "silencedetect=noise=-35dB:d=0.2", "-f", "null", "-"]);
  const ev = [...log.matchAll(/silence_(start|end): ([\d.]+)/g)];
  const sil: [number, number][] = [];
  let st: number | null = null;
  for (const [, k, v] of ev) {
    if (k === "start") st = Number(v);
    else { sil.push([st ?? 0, Number(v)]); st = null; }
  }
  if (st !== null) sil.push([st, dur]);
  let a = 0, b = dur;
  for (const [s, e] of sil) {
    if (s <= 0.05 && e < 1.5) a = Math.max(0, e - 0.06);
    if (e >= dur - 0.05 && s > dur - 3) b = Math.min(dur, s + 0.18);
  }
  return { a, b: Math.max(b, a + 0.5) };
}

/** Grabs one still per clip (for the visual review). */
export async function still(file: string, at: number, out: string) {
  await ff(["-y", "-v", "error", "-ss", at.toFixed(2), "-i", file, "-frames:v", "1", "-vf", "scale=-2:480", out]);
}

// ---------- captions ----------
export interface CaptionStyle { preset: 1 | 2 | 3 | 4; size: number }
const ts = (t: number) => `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}`;
const srtTs = (t: number) => {
  const ms = Math.round(t * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};

/** Builds the .ass captions (and an .srt) from word timings on the final timeline. */
export function captions(words0: Word[], W: number, H: number, aspect: string, style: CaptionStyle) {
  // join "34" + ",000" back into one token
  const words: Word[] = [];
  for (const w of words0) {
    const last = words[words.length - 1];
    if (last && /^[,.]?\d{3}[.,]?$/.test(w.w) && /\d$/.test(last.w)) { last.w += w.w.startsWith(",") ? w.w : `,${w.w}`; last.e = w.e; continue; }
    words.push({ ...w });
  }
  let size = style.size;
  if (aspect === "1:1" || aspect === "16:9") size = Math.round(size * 0.8);
  const [MAXW, MAXC] = size >= 92 ? [3, 15] : size >= 72 ? [3, 19] : [4, 26];
  const cues: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    if (cur.length && [...cur, w].map((x) => x.w).join(" ").length > MAXC) { cues.push(cur); cur = []; }
    cur.push(w);
    const nx = words[i + 1];
    if (cur.length >= MAXW || /[.,!?:]$/.test(w.w) || (nx && nx.s - w.e > 0.35) || !nx) { cues.push(cur); cur = []; }
  });
  const p = style.preset;
  const up = p === 4;
  const col = p === 4 ? "&H0000E1FF" : "&H00FFFFFF";
  const [border, back, outl] = p === 3 ? [3, "&HD0000000", Math.max(8, Math.floor(size / 7))] : [1, "&H64000000", Math.max(4, Math.floor(size / 10))];
  const mv = Math.round(H * (aspect === "9:16" || aspect === "4:5" ? 0.26 : 0.12));
  const ass = [
    "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${W}`, `PlayResY: ${H}`, "WrapStyle: 0", "", "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Cap,Montserrat ExtraBold,${size},${col},&H00FFFFFF,&H00000000,${back},-1,0,0,0,100,100,0,0,${border},${outl},${p === 3 ? 0 : 2},2,40,40,${mv},1`,
    "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  const srt: string[] = [];
  cues.forEach((c, k) => {
    const a = c[0].s;
    let b = c[c.length - 1].e;
    if (k + 1 < cues.length) b = Math.min(Math.max(b + 0.15, a + 0.5), cues[k + 1][0].s);
    const toks = c.map((x) => x.w);
    toks[toks.length - 1] = toks[toks.length - 1].replace(/,$/, "");
    const disp = toks.map((t) => (up ? t.toUpperCase() : t).replace(/[{}\\]/g, ""));
    if (p === 2) {
      c.forEach((w, j) => {
        const s0 = j === 0 ? a : w.s;
        const e0 = j + 1 < c.length ? c[j + 1].s : b;
        if (e0 <= s0) return;
        const line = disp.map((t, q) => (q === j ? `{\\c&H00E1FF&}${t}{\\c&HFFFFFF&}` : t)).join(" ");
        ass.push(`Dialogue: 0,${ts(s0)},${ts(e0)},Cap,,0,0,0,,${line}`);
      });
    } else {
      ass.push(`Dialogue: 0,${ts(a)},${ts(b)},Cap,,0,0,0,,${disp.join(" ")}`);
    }
    srt.push(`${k + 1}\n${srtTs(a)} --> ${srtTs(b)}\n${toks.join(" ")}\n`);
  });
  return { ass: `${ass.join("\n")}\n`, srt: srt.join("\n"), cues: cues.length };
}

export const frameSize = (aspect: string): [number, number] =>
  aspect === "1:1" ? [720, 720] : aspect === "16:9" ? [1280, 720] : aspect === "4:5" ? [720, 900] : [720, 1280];

export interface BuildClip { file: string; a: number; b: number; audio: boolean }

/** Joins the trimmed clips and burns the captions in one encode. Returns the mp4 bytes. */
export async function build(dir: string, clips: BuildClip[], aspect: string, assText: string | null) {
  const [W, H] = frameSize(aspect);
  const args: string[] = ["-y", "-v", "error"];
  clips.forEach((c) => args.push("-ss", c.a.toFixed(3), "-to", c.b.toFixed(3), "-i", c.file));
  const silent: number[] = [];
  clips.forEach((c, i) => {
    if (!c.audio) { silent[i] = clips.length + silent.filter((x) => x !== undefined).length; args.push("-f", "lavfi", "-t", (c.b - c.a).toFixed(3), "-i", "anullsrc=r=44100:cl=stereo"); }
  });
  const VF = `fps=30,scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
  const parts: string[] = [];
  clips.forEach((c, i) => {
    parts.push(`[${i}:v]${VF},setpts=PTS-STARTPTS[v${i}]`);
    const src = c.audio ? `${i}:a` : `${silent[i]}:a`;
    parts.push(`[${src}]aresample=44100,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`);
  });
  parts.push(`${clips.map((_, i) => `[v${i}][a${i}]`).join("")}concat=n=${clips.length}:v=1:a=1[vc][ac]`);
  if (assText) {
    await writeFile(path.join(dir, "caps.ass"), assText);
    const esc = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    parts.push(`[vc]ass=filename='${esc(path.join(dir, "caps.ass"))}':fontsdir='${esc(FONTS)}'[vo]`);
  }
  const out = path.join(dir, "final.mp4");
  args.push("-filter_complex", parts.join(";"), "-map", assText ? "[vo]" : "[vc]", "-map", "[ac]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out);
  await ff(args, 280_000);
  return readFile(out);
}

export async function workdir(id: string) {
  const dir = path.join("/tmp", `creads-${id.replace(/[^a-z0-9-]/gi, "")}`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  return dir;
}
