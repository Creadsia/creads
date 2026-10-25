import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { ff } from "./montage";

// «Editor de video» (owner, 25 Oct 2026: «lo más pro que se pueda», at a low cost for Creads). A finished ad is
// re-cut from its own clips: order, trims, texts on top, subtitles, music and the format. Nothing is generated
// again (no AI models): the browser previews it and the montage engine renders it once on export.

import type { Formato, Fuente, Proyecto, Texto } from "./editor-tipos";
import { ANIMACIONES, FORMATOS, FUENTES } from "./editor-tipos";
export * from "./editor-tipos";

const num = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : d);

/** A project from the browser, made safe (unknown clips dropped, numbers in range). */
export function limpiarProyecto(v: unknown, clips: Set<string>): Proyecto {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const cortes = (Array.isArray(o.cortes) ? o.cortes : []).slice(0, 30).map((c) => c as Record<string, unknown>)
    .filter((c) => typeof c.clipId === "string" && clips.has(c.clipId))
    .map((c) => { const a = num(c.a, 0, 600, 0); return { clipId: String(c.clipId), a, b: Math.max(a + 0.3, num(c.b, 0, 600, a + 1)) }; });
  const textos = (Array.isArray(o.textos) ? o.textos : []).slice(0, 20).map((t) => t as Record<string, unknown>).map((t, i) => {
    const desde = num(t.desde, 0, 600, 0);
    return {
      id: typeof t.id === "string" ? t.id.slice(0, 20) : `t${i}`, texto: String(t.texto ?? "").replace(/[{}\\]/g, "").slice(0, 160),
      desde, hasta: Math.max(desde + 0.3, num(t.hasta, 0, 600, desde + 2)), x: num(t.x, 0, 100, 50), y: num(t.y, 0, 100, 20), tam: num(t.tam, 2, 20, 7),
      color: hex(t.color, "#FFFFFF"), fondo: t.fondo === null ? null : hex(t.fondo, "#000000"),
      fuente: (FUENTES as readonly string[]).includes(String(t.fuente)) ? (t.fuente as Fuente) : "Montserrat ExtraBold",
      animacion: (ANIMACIONES as readonly string[]).includes(String(t.animacion)) ? (t.animacion as Texto["animacion"]) : "pop",
    };
  }).filter((t) => t.texto.trim());
  const m = o.musica as Record<string, unknown> | null | undefined;
  return {
    cortes, textos, subtitulos: o.subtitulos !== false,
    musica: m && typeof m.url === "string" ? { url: m.url, nombre: String(m.nombre ?? "Música").slice(0, 80), vol: num(m.vol, 0, 100, 25) } : null,
    vozVol: num(o.vozVol, 0, 150, 100),
    formato: (FORMATOS as readonly string[]).includes(String(o.formato)) ? (o.formato as Formato) : "9:16",
  };
}

const t = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return `${h}:${String(m).padStart(2, "0")}:${x.toFixed(2).padStart(5, "0")}`; };
/** #RRGGBB → ASS &HAABBGGRR */
const assColor = (h: string, alpha = 0) => `&H${alpha.toString(16).padStart(2, "0").toUpperCase()}${h.slice(5, 7)}${h.slice(3, 5)}${h.slice(1, 3)}`;

/** The texts on top of the video, as subtitles burnt in (positions, fonts, box, entrance). */
export function textosAss(textos: Texto[], W: number, H: number) {
  const lines = textos.map((x) => {
    const size = Math.round((x.tam / 100) * W);
    const px = Math.round((x.x / 100) * W), py = Math.round((x.y / 100) * H);
    const box = x.fondo ? `\\3c${assColor(x.fondo)}\\4c${assColor(x.fondo)}\\bord${Math.max(6, Math.round(size * 0.28))}\\shad0` : `\\3c&H00000000&\\bord${Math.max(2, Math.round(size * 0.08))}\\shad${Math.max(1, Math.round(size * 0.05))}`;
    const anim = x.animacion === "pop" ? "\\fscx70\\fscy70\\t(0,160,\\fscx108\\fscy108)\\t(160,260,\\fscx100\\fscy100)" : x.animacion === "aparecer" ? "\\fad(220,120)" : x.animacion === "subir" ? `\\move(${px},${py + Math.round(H * 0.04)},${px},${py},0,240)\\fad(200,0)` : "";
    const pos = x.animacion === "subir" ? "" : `\\pos(${px},${py})`;
    const text = x.texto.replace(/\n/g, "\\N");
    return `Dialogue: 1,${t(x.desde)},${t(x.hasta)},T,,0,0,0,,{\\an5${pos}\\fn${x.fuente}\\fs${size}\\c${assColor(x.color)}${box}${anim}}${text}`;
  });
  return `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: T,Montserrat ExtraBold,48,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,3,1,5,${Math.round(W * 0.06)},${Math.round(W * 0.06)},0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${lines.join("\n")}
`;
}

const FONTS = path.join(process.cwd(), "assets", "fonts");
const e = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");

/** Burns the texts on the finished cut (one encode; the sound is copied). */
export async function pasadaTextos(dir: string, bytes: Uint8Array | Buffer, ass: string, antes = "") {
  const input = path.join(dir, "ed-in.mp4"), out = path.join(dir, "ed-textos.mp4"), file = path.join(dir, "ed-textos.ass");
  await writeFile(input, bytes);
  await writeFile(file, ass);
  await ff(["-y", "-v", "error", "-i", input, "-vf", `${antes ? `${antes},` : ""}ass=filename='${e(file)}':fontsdir='${e(FONTS)}'`,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", out], 240_000);
  return readFile(out);
}

/** The voice at its volume and the music under it (looped to the length, faded out at the end). */
export async function pasadaAudio(dir: string, bytes: Uint8Array | Buffer, musica: string | null, vozVol: number, musicaVol: number, segundos: number) {
  const input = path.join(dir, "ed-a.mp4"), out = path.join(dir, "ed-audio.mp4");
  await writeFile(input, bytes);
  const voz = `[0:a]volume=${(vozVol / 100).toFixed(2)}[v]`;
  const args = ["-y", "-v", "error", "-i", input];
  let filtro: string;
  if (musica) {
    args.push("-stream_loop", "-1", "-i", musica);
    const fade = Math.max(0, segundos - 1.2).toFixed(2);
    filtro = `${voz};[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=${(musicaVol / 100).toFixed(2)},atrim=0:${segundos.toFixed(2)},afade=t=out:st=${fade}:d=1.2[m];[v][m]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[a]`;
  } else filtro = `${voz.replace("[v]", "[a]")}`;
  args.push("-filter_complex", filtro, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out);
  await ff(args, 200_000);
  return readFile(out);
}
