import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import type { Word } from "./textmatch";
import { type CaptionStyle, assColor, assInline, fontOf, fontPx, marginPx, normalizeStyle, shapeWord } from "./caption-style";

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
    // only local files: a customer's upload disguised as a playlist can't make FFmpeg fetch other addresses
    const r = await run(ffmpeg(), ["-hide_banner", "-protocol_whitelist", "file,pipe", ...args], { maxBuffer: 64 * 1024 * 1024, timeout: timeoutMs });
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
  // ffmpeg exits with an error here on purpose (no output); the full log still has what we need.
  const log = await run(ffmpeg(), ["-hide_banner", "-i", file, "-f", "null", "-t", "0", "-"], { maxBuffer: 8 * 1024 * 1024, timeout: 30_000 })
    .then((r) => r.stderr + r.stdout)
    .catch((e: { stderr?: string; message?: string }) => `${e.stderr ?? ""}${e.message ?? ""}`);
  const m = log.match(/Duration: (\d+):(\d+):([\d.]+)/);
  const dur = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
  return { dur, audio: /Stream #\d+:\d+[^:]*: Audio/.test(log) };
}

/** Where the last sound of a clip ends (the trailing silence is cut), for shots where someone talks. */
export async function speechEnd(file: string, dur: number) {
  const log = await ff(["-i", file, "-af", "silencedetect=noise=-32dB:d=0.35", "-f", "null", "-"]);
  const ev = [...log.matchAll(/silence_(start|end): ([\d.]+)/g)];
  let lastStart: number | null = null;
  for (const [, k, v] of ev) {
    if (k === "start") lastStart = Number(v);
    else if (Number(v) < dur - 0.3) lastStart = null; // that silence ended before the clip did: sound came after it
  }
  // a silence that runs to the end of the clip: speech ended where it began
  return lastStart !== null && lastStart > 0.3 ? Math.min(dur, lastStart + 0.2) : dur;
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
export type { CaptionStyle } from "./caption-style";
const ts = (t: number) => `${Math.floor(t / 3600)}:${String(Math.floor((t % 3600) / 60)).padStart(2, "0")}:${(t % 60).toFixed(2).padStart(5, "0")}`;
const srtTs = (t: number) => {
  const ms = Math.round(t * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, "0")}:${String(Math.floor(ms / 60000) % 60).padStart(2, "0")}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};

/** Lowercase letters and digits only, no accents: how two spellings of the same word are compared. */
const bare = (w: string) => w.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9ñ]/g, "");

/**
 * Spells the transcribed words as in the script (keeps the timings). The transcription sometimes hears
 * "their" for "there", drops accents or writes numbers differently; the script is what the person
 * was told to say, so its spelling wins wherever the two line up.
 */
export function respell(words: Word[], script: string): Word[] {
  const toks = script.split(/\s+/).filter((t) => bare(t));
  const a = words.map((w) => bare(w.w));
  const b = toks.map(bare);
  const n = a.length, m = b.length;
  if (!n || !m) return words;
  // edit distance table (match = 0, substitute/insert/delete = 1)
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) d[i][j] = Math.min(d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), d[i - 1][j] + 1, d[i][j - 1] + 1);
  const out = words.map((w) => ({ ...w }));
  let i = n, j = m;
  while (i > 0 && j > 0) {
    const diag = d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
    if (d[i][j] === diag) {
      // same word, or a word heard wrong in the same spot: show the script's spelling
      out[i - 1].w = toks[j - 1];
      i--; j--;
    } else if (d[i][j] === d[i - 1][j] + 1) i--;
    else j--;
  }
  return out;
}

/**
 * The «Hecho con Creads IA» badge: a small violet tag over the brand name, top left (bottom left when the
 * captions go on top), inside the area Instagram and TikTok leave clear.
 */
function selloStyles(W: number, H: number, bottom: boolean) {
  const tag = Math.round(W * 0.032), name = Math.round(W * 0.078);
  const left = Math.round(W * 0.07), top = Math.round(H * 0.085);
  const violet = assColor("#8A5CFF"), white = assColor("#FFFFFF"), black = assColor("#000000", 0x60);
  const al = bottom ? 1 : 7;
  const tagV = bottom ? Math.round(H * 0.2) + Math.round(name * 1.25) : top;
  const nameV = bottom ? Math.round(H * 0.2) : top + Math.round(tag * 1.55);
  return [
    `Style: SelloTag,Montserrat ExtraBold,${tag},${white},${white},${violet},${violet},0,0,0,0,100,100,1,0,3,${Math.max(4, Math.round(tag * 0.35))},0,${al},${left},50,${tagV},1`,
    `Style: SelloName,Montserrat ExtraBold,${name},${white},${white},${black},${black},0,0,0,0,100,100,0,0,1,${Math.max(2, Math.round(name / 18))},${Math.max(1, Math.round(name / 30))},${al},${left},50,${nameV},1`,
  ];
}

/** Builds the .ass captions (and an .srt) from word timings on the final timeline. */
export function captions(words0: Word[], W: number, H: number, aspect: string, style0: CaptionStyle, totalSec = 0) {
  const st = normalizeStyle(style0);
  // join "34" + ",000" back into one token
  const words: Word[] = [];
  for (const w of words0) {
    const last = words[words.length - 1];
    if (last && /^[,.]?\d{3}[.,]?$/.test(w.w) && /\d$/.test(last.w)) { last.w += w.w.startsWith(",") ? w.w : `,${w.w}`; last.e = w.e; continue; }
    words.push({ ...w });
  }
  const font = fontOf(st.font);
  const vertical = aspect === "9:16" || aspect === "4:5";
  const size = fontPx(st.size, W, H);
  const caps = st.case === "upper" || font.capsOnly;
  const maxWords = st.look === "palabra" ? 1 : st.words;
  // how many characters fit on one line at this size (bold caps are wider)
  const maxChars = Math.max(6, Math.floor((W * 0.86) / (size * font.width * (caps ? 1.15 : 1))));

  const cues: Word[][] = [];
  let cur: Word[] = [];
  words.forEach((w, i) => {
    if (cur.length && [...cur, w].map((x) => x.w).join(" ").length > maxChars) { cues.push(cur); cur = []; }
    cur.push(w);
    const nx = words[i + 1];
    if (cur.length >= maxWords || /[.,!?:]$/.test(w.w) || (nx && nx.s - w.e > 0.35) || !nx) { cues.push(cur); cur = []; }
  });

  const outline = Math.max(3, Math.round(size / 11));
  const look = st.look;
  // BorderStyle 3 = opaque box behind the text
  const [border, outl, shadow, outCol, backCol] =
    look === "caja" ? [3, Math.max(10, Math.round(size / 6)), 0, assColor("#000000", 0x30), assColor("#000000", 0x30)]
      : look === "suave" ? [1, 0, Math.max(3, Math.round(size / 14)), assColor("#000000"), assColor("#000000", 0x60)]
        : [1, outline, Math.max(2, Math.round(size / 24)), assColor("#000000"), assColor("#000000", 0x64)];
  const align = st.position === "arriba" ? 8 : st.position === "centro" ? 5 : 2;
  const mv = marginPx(st.position, H, vertical);
  const ass = [
    "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${W}`, `PlayResY: ${H}`, "WrapStyle: 0", "ScaledBorderAndShadow: yes", "", "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Cap,${font.ass},${size},${assColor(st.color)},${assColor(st.accent)},${outCol},${backCol},0,0,0,0,100,100,0,0,${border},${outl},${shadow},${align},50,50,${mv},1`,
    ...selloStyles(W, H, st.position === "arriba"),
    "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ];
  if (st.sello) {
    const end = Math.max(totalSec, words.length ? words[words.length - 1].e : 0, 1) + 1;
    ass.push(`Dialogue: 1,${ts(0)},${ts(end)},SelloTag,,0,0,0,,HECHO CON`, `Dialogue: 1,${ts(0)},${ts(end)},SelloName,,0,0,0,,Creads IA`);
  }
  const srt: string[] = [];
  const clean = (t: string) => t.replace(/[{}\\]/g, "");
  const accent = assInline(st.accent), base = assInline(st.color);
  cues.forEach((c, k) => {
    const a = c[0].s;
    let b = c[c.length - 1].e;
    if (k + 1 < cues.length) b = Math.min(Math.max(b + 0.15, a + (look === "palabra" ? 0.25 : 0.5)), cues[k + 1][0].s);
    const toks = c.map((x) => x.w);
    toks[toks.length - 1] = toks[toks.length - 1].replace(/,$/, "");
    const disp = toks.map((t) => clean(shapeWord(t, st))).map((t) => (font.capsOnly && st.case !== "lower" ? t.toLocaleUpperCase("es") : t));
    if (look === "resaltar") {
      c.forEach((w, j) => {
        const s0 = j === 0 ? a : w.s;
        const e0 = j + 1 < c.length ? c[j + 1].s : b;
        if (e0 <= s0) return;
        const line = disp.map((t, q) => (q === j ? `{\\c${accent}}${t}{\\c${base}}` : t)).join(" ");
        ass.push(`Dialogue: 0,${ts(s0)},${ts(e0)},Cap,,0,0,0,,${line}`);
      });
    } else if (look === "palabra") {
      // one word, a quick "pop" as it appears
      ass.push(`Dialogue: 0,${ts(a)},${ts(b)},Cap,,0,0,0,,{\\fscx80\\fscy80\\t(0,90,\\fscx108\\fscy108)\\t(90,160,\\fscx100\\fscy100)}${disp.join(" ")}`);
    } else {
      ass.push(`Dialogue: 0,${ts(a)},${ts(b)},Cap,,0,0,0,,${disp.join(" ")}`);
    }
    srt.push(`${k + 1}\n${srtTs(a)} --> ${srtTs(b)}\n${toks.map((t) => shapeWord(t, { case: "normal", punct: true })).join(" ")}\n`);
  });
  return { ass: `${ass.join("\n")}\n`, srt: srt.join("\n"), cues: cues.length };
}

export const frameSize = (aspect: string): [number, number] =>
  aspect === "1:1" ? [720, 720] : aspect === "16:9" ? [1280, 720] : aspect === "4:5" ? [720, 900] : [720, 1280];

export interface BuildClip {
  file: string;
  a: number; // where speech starts in the clip
  b: number; // where it ends
  audio: boolean;
  /** Voice-over formats: a separate narration track that sets the length of this segment. */
  voice?: { file: string; a: number; b: number };
}

/** How long a clip lasts in the final ad. */
export const segLen = (c: BuildClip) => (c.voice ? c.voice.b - c.voice.a : c.b - c.a);

/** Joins the trimmed clips and burns the captions in one encode. Returns the mp4 bytes. */
export async function build(dir: string, clips: BuildClip[], aspect: string, assText: string | null) {
  const [W, H] = frameSize(aspect);
  const args: string[] = ["-y", "-v", "error"];
  const VF = `fps=30,scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1`;
  const parts: string[] = [];
  let n = 0;
  clips.forEach((c, i) => {
    const L = segLen(c).toFixed(3);
    if (c.voice) {
      // the picture runs from the start of the clip and holds its last frame if the narration is longer
      const vi = n++; args.push("-i", c.file);
      const ai = n++; args.push("-ss", c.voice.a.toFixed(3), "-to", c.voice.b.toFixed(3), "-i", c.voice.file);
      parts.push(`[${vi}:v]${VF},tpad=stop_mode=clone:stop_duration=30,trim=duration=${L},setpts=PTS-STARTPTS[v${i}]`);
      parts.push(`[${ai}:a]aresample=44100,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`);
      return;
    }
    const vi = n++; args.push("-ss", c.a.toFixed(3), "-to", c.b.toFixed(3), "-i", c.file);
    let ai = vi;
    if (!c.audio) { ai = n++; args.push("-f", "lavfi", "-t", L, "-i", "anullsrc=r=44100:cl=stereo"); }
    parts.push(`[${vi}:v]${VF},setpts=PTS-STARTPTS[v${i}]`);
    parts.push(`[${ai}:a]aresample=44100,aformat=channel_layouts=stereo,asetpts=PTS-STARTPTS[a${i}]`);
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

/**
 * Animated stories: every shot cut to its planned length (hard cuts, like the reference films), then the
 * film's music underneath. Shots where a character speaks keep their own voice and the music dips
 * under it; narrator lines start with their shot. Optional subtitles (one line per shot) and a short
 * fade at the end.
 */
export interface StoryCut { file: string; secs: number; voice?: boolean; text?: string; ambient?: boolean; muted?: boolean }
export async function buildStory(dir: string, shots: StoryCut[], aspect: string, music: string | null, narration: { file: string; at: number; secs?: number; text?: string }[] = [], subtitles = false) {
  const [W, H] = frameSize(aspect);
  const args: string[] = ["-y", "-v", "error"];
  const parts: string[] = [];
  let n = 0;
  const total = shots.reduce((a, x) => a + x.secs, 0);
  const starts: number[] = [];
  shots.reduce((a, x) => { starts.push(a); return a + x.secs; }, 0);
  const vin: number[] = [];
  shots.forEach((sh, i) => {
    const vi = n++;
    vin.push(vi);
    args.push("-i", sh.file);
    parts.push(`[${vi}:v]fps=30,scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,tpad=stop_mode=clone:stop_duration=10,trim=duration=${sh.secs.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`);
  });
  const fadeAt = Math.max(0, total - 0.6).toFixed(3);
  parts.push(`${shots.map((_, i) => `[v${i}]`).join("")}concat=n=${shots.length}:v=1:a=0,fade=t=out:st=${fadeAt}:d=0.6[vc]`);

  // subtitles: the spoken line of each shot, on screen while it plays
  const subs: { a: number; b: number; text: string }[] = [];
  if (subtitles) {
    shots.forEach((sh, i) => { if ((sh.voice || sh.muted) && sh.text?.trim()) subs.push({ a: starts[i] + 0.15, b: starts[i] + sh.secs - 0.1, text: sh.text.trim() }); });
    for (const l of narration) if (l.text?.trim()) subs.push({ a: l.at + 0.4, b: Math.min(total, l.at + 0.4 + (l.secs ?? 3)), text: l.text.trim() });
  }
  if (subs.length) {
    const t = (x: number) => { const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), s = x % 60; return `${h}:${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`; };
    const size = Math.round((Math.min(W, H) / 1080) * 64);
    const ass = [
      "[Script Info]", "ScriptType: v4.00+", `PlayResX: ${W}`, `PlayResY: ${H}`, "WrapStyle: 0", "",
      "[V4+ Styles]",
      "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
      `Style: Sub,Montserrat ExtraBold,${size},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,${Math.max(2, Math.round(size / 14))},1,2,${Math.round(W * 0.08)},${Math.round(W * 0.08)},${Math.round(H * 0.16)},1`,
      "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
      ...subs.map((x) => `Dialogue: 0,${t(x.a)},${t(x.b)},Sub,,0,0,0,,${x.text.replace(/[{}]/g, "").replace(/\n/g, " ")}`),
    ].join("\n");
    await writeFile(path.join(dir, "story.ass"), `${ass}\n`);
    const esc = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
    parts.push(`[vc]ass=filename='${esc(path.join(dir, "story.ass"))}':fontsdir='${esc(FONTS)}'[vo]`);
  } else parts.push(`[vc]null[vo]`);

  const T = total.toFixed(3);
  const fadeA = Math.max(0, total - 1.5).toFixed(3);
  const tracks: string[] = [];
  // where someone talks (on camera or narrator), the music goes down
  const talk: [number, number][] = [
    ...shots.flatMap((sh, i) => (sh.voice ? [[starts[i], starts[i] + sh.secs] as [number, number]] : [])),
    ...narration.map((l) => [l.at, l.at + 0.4 + (l.secs ?? 3)] as [number, number]),
  ];
  if (music) {
    const mi = n++;
    args.push("-i", music); // (made to the film's length; padded with silence if it's ever short)
    const dips = talk.map(([a, b]) => `,volume=0.25:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})'`).join("");
    parts.push(`[${mi}:a]aresample=44100,aformat=channel_layouts=stereo,apad=whole_dur=${T},atrim=duration=${T},asetpts=PTS-STARTPTS${dips},afade=t=out:st=${fadeA}:d=1.5[mus]`);
    tracks.push("[mus]");
  }
  shots.forEach((sh, i) => {
    if (!sh.voice && !sh.ambient) return;
    const ms = Math.round(starts[i] * 1000);
    // a spoken line at full volume; the scene's ambient sound softer, faded in and out between cuts
    const vol = sh.voice ? "" : ",volume=0.45";
    const fin = sh.voice ? "" : ",afade=t=in:st=0:d=0.12";
    parts.push(`[${vin[i]}:a]aresample=44100,aformat=channel_layouts=stereo,atrim=duration=${sh.secs.toFixed(3)}${vol}${fin},afade=t=out:st=${Math.max(0, sh.secs - 0.15).toFixed(3)}:d=0.15,adelay=${ms}|${ms}[d${i}]`);
    tracks.push(`[d${i}]`);
  });
  narration.forEach((l, i) => {
    const ni = n++;
    args.push("-i", l.file);
    const ms = Math.round((l.at + 0.4) * 1000);
    parts.push(`[${ni}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[n${i}]`);
    tracks.push(`[n${i}]`);
  });
  if (!tracks.length) { const zi = n++; args.push("-f", "lavfi", "-t", T, "-i", "anullsrc=r=44100:cl=stereo"); tracks.push(`[${zi}:a]`); }
  // music + voices + ambience added together can clip on loud scenes: a limiter keeps it clean
  parts.push(`${tracks.join("")}amix=inputs=${tracks.length}:duration=longest:normalize=0,alimiter=limit=0.95,apad=whole_dur=${T},atrim=duration=${T}[ao]`);
  const out = path.join(dir, "final.mp4");
  args.push("-filter_complex", parts.join(";"), "-map", "[vo]", "-map", "[ao]", "-t", T,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out);
  await ff(args, 280_000);
  return { bytes: await readFile(out), seconds: total };
}

/** Any audio or video → a clean mono mp3 for voice cloning (first `maxSec` seconds). Returns its length. */
export async function voiceSample(file: string, out: string, maxSec = 180) {
  await ff(["-y", "-i", file, "-vn", "-ac", "1", "-ar", "44100", "-b:a", "128k", "-t", String(maxSec), out], 90_000);
  return (await probe(out)).dur;
}

/** A small JPEG of a picture (to show it to Claude without sending megabytes). */
export async function thumbnail(file: string, out: string, width = 512) {
  await ff(["-y", "-i", file, "-vf", `scale=${width}:-2`, "-q:v", "5", "-frames:v", "1", out], 30_000);
  return readFile(out);
}

/** Deletes work folders left by earlier jobs (older than 15 minutes) so the server's disk never fills up. */
async function sweepWork() {
  const now = Date.now();
  const names = await readdir("/tmp").catch(() => [] as string[]);
  await Promise.all(names.filter((n) => n.startsWith("creads-")).map(async (n) => {
    const p = path.join("/tmp", n);
    const st = await stat(p).catch(() => null);
    if (st && now - st.mtimeMs > 15 * 60_000) await rm(p, { recursive: true, force: true }).catch(() => null);
  }));
}

export async function workdir(id: string) {
  await sweepWork();
  const dir = path.join("/tmp", `creads-${id.replace(/[^a-z0-9-]/gi, "")}`);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  return dir;
}
