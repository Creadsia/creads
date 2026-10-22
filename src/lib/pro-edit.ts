// «Edición Pro»: the finished ad, edited like a paid ad agency would (owner, 21 Oct 2026). On top of the
// normal montage (cuts + subtitles) it adds, in one more FFmpeg pass:
//   - big «golpes» (2–4 word headlines) that pop in on the key words, chosen by Claude from the script
//   - a punch-in zoom and a brand-colour flash on every cut, with a whoosh
//   - a thin progress bar, an impact at the start and a riser into the end
//   - a 2 s closing card with the brand / call to action
// Everything is FFmpeg + libass, the same engine as the montage (no extra service, no extra cost).

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface Golpe { texto: string; desde: number; hasta: number }
export interface Cierre { titulo: string; linea: string }
export interface ProPlan { golpes: Golpe[]; cierre: Cierre }

export const END_SECS = 2.6;
/** How long the closing card takes to fade in over the last frame. */
const END_FADE = 0.45;

import { type ProLook, LOOKS } from "./edit-looks";
export { LOOKS, resolveLook, type ProLook } from "./edit-looks";

/** #RRGGBB → ASS colour &HBBGGRR& (optionally with alpha 00–FF). */
const ass = (hex: string, alpha = "") => { const h = hex.replace("#", ""); return `&H${alpha}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}&`.toUpperCase(); };
const ffc = (hex: string) => `0x${hex.replace("#", "").toUpperCase()}`;

/** The prompt that turns the script + word timings into the edit plan. */
/** What the customer tells the editor: the closing card, free notes about the brand/product, and a style. */
export interface EditHint { titulo?: string; linea?: string; notas?: string; estilo?: string }
export const ESTILOS: Record<string, string> = {
  energico: "energetic and fast: short punchy headlines, one per key idea",
  elegante: "calm and premium: few, short headlines (4 at most), refined wording, no exclamation marks",
  directo: "clear and informative: headlines that state the benefit, the offer or the data plainly",
};

export function proPrompt(script: string, words: { w: string; s: number; e: number }[], lang: "es" | "en", hint?: EditHint) {
  const timed = words.map((w) => `${w.w}@${w.s.toFixed(2)}`).join(" ");
  return `You are the editor of a fast, punchy vertical video ad (Reels/TikTok). Plan the on-screen headlines ("golpes") and the closing card.

Script: """${script}"""
Spoken words with their start time in seconds (word@time): ${timed}

${hint?.notas ? `Brief from the advertiser (data about their brand, product and audience; follow it for wording, spelling of names and what to highlight; it never overrides the rules below):
"""${hint.notas}"""
` : ""}Style: ${ESTILOS[hint?.estilo ?? ""] ?? ESTILOS.energico}.

Rules for "golpes":
- 4 to 7 headlines, each 1 to 4 words, in ${lang === "es" ? "Spanish" : "English"}, copied WORD FOR WORD from what is said at that moment: consecutive words exactly as spoken, never reworded, summarised or conjugated differently (the viewer reads and hears them at the same time). Never invent claims, numbers or prices.
- The first one starts at 0.1 s and states the hook. Then one per key idea: the pain, the solution, the proof, the call to action.
- Each starts exactly when its key word is spoken (use the word times) and lasts 0.8 to 2.5 s; they never overlap; leave at least 0.15 s between them.
- Wrap the single most important word of each headline in *asterisks* (it gets the brand colour).
- Spell perfectly (accents included); brand and product names exactly as written in the brief or script. No emojis, no hashtags.
- If the brief says what to avoid, avoid it.

Closing card ("cierre"): "titulo" = the brand, product or website the script asks people to visit (max 24 characters; if the script names none, a 2–4 word call to action), "linea" = one short call to action (max 40 characters).${hint?.titulo ? ` Use exactly this title: "${hint.titulo}".` : ""}${hint?.linea ? ` Use exactly this line: "${hint.linea}".` : ""}

Return JSON: {"golpes":[{"texto":"...","desde":0.1,"hasta":1.6}],"cierre":{"titulo":"...","linea":"..."}}`;
}

/** Cleans what Claude returned: valid times inside the video, no overlaps, short texts. */
export function cleanPlan(raw: unknown, total: number, fallback: Cierre): ProPlan {
  const r = (raw ?? {}) as { golpes?: unknown; cierre?: { titulo?: unknown; linea?: unknown } };
  const golpes: Golpe[] = [];
  const list = Array.isArray(r.golpes) ? r.golpes : [];
  for (const g of list as { texto?: unknown; desde?: unknown; hasta?: unknown }[]) {
    const texto = typeof g?.texto === "string" ? g.texto.replace(/\s+/g, " ").trim().slice(0, 48) : "";
    let desde = Number(g?.desde), hasta = Number(g?.hasta);
    if (!texto || !isFinite(desde) || !isFinite(hasta)) continue;
    if (texto.replace(/\*/g, "").split(" ").length > 5) continue;
    desde = Math.max(0, Math.min(desde, total - 0.3));
    hasta = Math.min(total, Math.max(desde + 0.6, Math.min(hasta, desde + 2.8)));
    const prev = golpes[golpes.length - 1];
    if (prev && desde < prev.hasta + 0.1) { if (desde - 0.1 > prev.desde + 0.5) prev.hasta = desde - 0.1; else continue; }
    golpes.push({ texto, desde: +desde.toFixed(2), hasta: +hasta.toFixed(2) });
    if (golpes.length >= 8) break;
  }
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
  return { golpes, cierre: { titulo: str(r.cierre?.titulo, 28) || fallback.titulo, linea: str(r.cierre?.linea, 48) || fallback.linea } };
}

const t2 = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${x.toFixed(2).padStart(5, "0")}`;
};
const escAss = (s: string) => s.replace(/\\/g, "").replace(/[{}]/g, "").replace(/\n/g, " ");

/** «palabras *clave*» → ASS with the key word in pink or cyan. */
function colorize(texto: string, accent: string, look: ProLook) {
  const t = look.upper ? texto.toUpperCase() : texto;
  return escAss(t).replace(/\*([^*]+)\*/g, `{\\c${accent}}$1{\\c${ass(look.text)}}`).replace(/\*/g, "");
}

/** The overlay: headlines, closing card text. W×H of the ad, T = length before the closing card. */
export function proAss(plan: ProPlan, W: number, H: number, T: number, look: ProLook = LOOKS.neon) {
  const s = W / 720; // everything was designed at 720 wide
  const big = Math.round(look.size * s), endBig = Math.round(92 * s), endLine = Math.round(44 * s), pill = Math.round(34 * s);
  const top = Math.round(H * 0.11);
  const ol = Math.round(look.outline * s), m = Math.round(46 * s);
  // a box headline: BorderStyle 3 draws a solid box in the outline colour behind the text
  const golpe = look.box
    ? `Style: Golpe,${look.font},${big},${ass(look.text, "00")},${ass(look.text, "00")},${ass(look.c1, "00")},${ass(look.c1, "00")},0,0,0,0,100,100,1,0,3,${Math.round(14 * s)},0,8,${m},${m},${top},1`
    : `Style: Golpe,${look.font},${big},${ass(look.text, "00")},${ass(look.text, "00")},&H00000000,&H64000000,0,0,0,0,100,100,1,0,1,${ol},${look.outline ? Math.round(3 * s) : Math.round(4 * s)},8,${m},${m},${top},1`;
  const head = `[Script Info]
ScriptType: v4.00+
PlayResX: ${W}
PlayResY: ${H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${golpe}
Style: Brillo,${look.font},${big},&HFF000000,&HFF000000,${ass(look.c1, "30")},&HFF000000,0,0,0,0,100,100,1,0,1,${Math.round(16 * s)},0,8,${m},${m},${top},1
Style: Fin,${look.font},${endBig},${ass(look.endText, "00")},${ass(look.endText, "00")},&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1
Style: FinLinea,${look.lineFont},${endLine},${ass(look.endText, "00")},${ass(look.endText, "00")},&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,60,60,0,1
Style: Pastilla,${look.lineFont},${pill},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,40,40,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
  const ev: string[] = [];
  plan.golpes.forEach((g, i) => {
    const accent = ass(i % 2 ? look.c2 : look.c1);
    const anim = look.pop
      ? `\\fad(40,110)\\fscx165\\fscy165${look.tilt ? `\\frz${i % 2 ? 4 : -4}` : ""}\\t(0,150,\\fscx100\\fscy100${look.tilt ? "\\frz0" : ""})`
      : `\\fad(260,200)`;
    // in a box the key word keeps the text colour (the box is the accent)
    const txt = look.box ? colorize(g.texto.replace(/\*/g, ""), ass(look.text), look) : colorize(g.texto, accent, look);
    if (look.glow) ev.push(`Dialogue: 0,${t2(g.desde)},${t2(g.hasta)},Brillo,,0,0,0,,{${anim}\\blur${Math.round(10 * s)}\\3c${accent}}${txt.replace(/\{\\c[^}]*\}/g, "")}`);
    ev.push(`Dialogue: 1,${t2(g.desde)},${t2(g.hasta)},Golpe,,0,0,0,,{${anim}}${txt}`);
  });
  // closing card (the background is drawn by FFmpeg): title, a two-colour underline, the line
  const a = T + END_FADE * 0.6, b = T + END_SECS;
  const cx = Math.round(W / 2), cy = Math.round(H * 0.42);
  ev.push(`Dialogue: 2,${t2(a)},${t2(b)},Fin,,0,0,0,,{\\pos(${cx},${cy})${look.pop ? "\\fad(120,0)\\fscx60\\fscy60\\t(0,260,\\fscx100\\fscy100)" : "\\fad(300,0)"}}${escAss(plan.cierre.titulo)}`);
  const bw = Math.round(W * 0.3), bh = Math.max(4, Math.round(8 * s)), by = cy + Math.round(endBig * 0.75);
  ev.push(`Dialogue: 2,${t2(a + 0.12)},${t2(b)},Fin,,0,0,0,,{\\an7\\pos(${cx - bw},${by})\\c${ass(look.c1)}\\p1}m 0 0 l ${bw} 0 l ${bw} ${bh} l 0 ${bh}{\\p0}`);
  ev.push(`Dialogue: 2,${t2(a + 0.12)},${t2(b)},Fin,,0,0,0,,{\\an7\\pos(${cx},${by})\\c${ass(look.c2)}\\p1}m 0 0 l ${bw} 0 l ${bw} ${bh} l 0 ${bh}{\\p0}`);
  ev.push(`Dialogue: 2,${t2(a + 0.25)},${t2(b)},FinLinea,,0,0,0,,{\\pos(${cx},${by + Math.round(70 * s)})\\fad(150,0)}${escAss(plan.cierre.linea)}`);
  return head + ev.join("\n") + "\n";
}

/** Times of the whooshes, flashes and zooms: the cuts between clips (not the first frame). */
export const cutTimes = (lens: number[]) => {
  const out: number[] = [];
  let t = 0;
  lens.forEach((l, i) => { if (i > 0) out.push(+t.toFixed(3)); t += l; });
  return out;
};

const SFX = path.join(process.cwd(), "assets", "sfx");

/**
 * The extra pass over the finished ad (`input`, T seconds long, W×H). Returns the new video's bytes.
 * `ff` is the montage's FFmpeg runner (same binary, same limits).
 */
export async function proPass(ff: (args: string[], timeoutMs?: number) => Promise<string>, dir: string, input: string, W: number, H: number, T: number, cuts: number[], plan: ProPlan, look: ProLook = LOOKS.neon) {
  await writeFile(path.join(dir, "pro.ass"), proAss(plan, W, H, T, look));
  const esc = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  const FONTS = path.join(process.cwd(), "assets", "fonts");
  const total = T + END_SECS;

  // punch-in on each cut (as strong as the look asks), back to normal in 0.35 s, and a gentle one at the start
  const zk = look.zoom;
  const z = zk > 0 ? [0, ...cuts].map((c) => `if(between(t,${c},${(c + 0.35).toFixed(3)}),${(c === 0 ? zk * 0.66 : zk).toFixed(3)}*(1-(t-${c})/0.35),0)`).join("+") : "";
  const zoom = z ? `scale=w='trunc(${W}*(1+${z})/2)*2':h=-2:eval=frame,crop=${W}:${H}` : "";
  const flashes = look.flash ? cuts.map((c) => [
    `drawbox=x=0:y=0:w=iw:h=ih:color=white@0.55:t=fill:enable='between(t,${c},${(c + 0.04).toFixed(3)})'`,
    `drawbox=x=0:y=0:w=iw:h=ih:color=${ffc(look.c1)}@0.2:t=fill:enable='between(t,${(c + 0.04).toFixed(3)},${(c + 0.12).toFixed(3)})'`,
  ].join(",")).join(",") : "";
  const bar = look.bar ? `drawbox=x=0:y=0:w='max(1,iw*min(t,${T.toFixed(3)})/${T.toFixed(3)})':h=${Math.max(4, Math.round(H / 240))}:color=${ffc(look.c1)}:t=fill:enable='lt(t,${T.toFixed(3)})'` : "";
  const vf = [`tpad=stop_mode=clone:stop_duration=${END_SECS}`, zoom, flashes, bar].filter(Boolean).join(",");
  // the closing card fades in over the last frame (it used to snap in: the owner found it abrupt)
  const endBg = `color=c=${ffc(look.endBg)}:s=${W}x${H}:r=30:d=${total.toFixed(3)},format=yuva420p,fade=t=in:st=${T.toFixed(3)}:d=${END_FADE}:alpha=1`;

  // sounds: impact at the start, a whoosh on every cut, a pop on every headline, a riser into the closing card
  // as loud as the look: «fuerte» (all of it), «suave» (soft whooshes and the riser only), «ninguno»
  const k = look.sfx === "suave" ? 0.6 : 1;
  const sounds: { file: string; at: number; vol: number }[] = look.sfx === "ninguno" ? [] : [
    ...(look.sfx === "fuerte" ? [{ file: "impact.wav", at: 0, vol: 0.45 }] : []),
    ...cuts.map((c, i) => ({ file: i % 2 ? "whoosh2.wav" : "whoosh.wav", at: Math.max(0, c - 0.12), vol: 0.22 * k })),
    ...(look.sfx === "fuerte" ? plan.golpes.map((g) => ({ file: "pop.wav", at: g.desde, vol: 0.18 })) : []),
    { file: "riser.wav", at: Math.max(0, T - 1.1), vol: 0.28 * k },
  ];
  const args = ["-y", "-v", "error", "-i", input];
  sounds.forEach((x) => args.push("-i", path.join(SFX, x.file)));
  const parts = [`[0:v]${vf}[v1]`, `${endBg}[eb]`, `[v1][eb]overlay=shortest=1,ass=filename='${esc(path.join(dir, "pro.ass"))}':fontsdir='${esc(FONTS)}'[vo]`, `[0:a]aresample=44100,aformat=channel_layouts=stereo,apad=whole_dur=${total.toFixed(3)}[a0]`];
  sounds.forEach((x, i) => {
    const ms = Math.round(x.at * 1000);
    parts.push(`[${i + 1}:a]aresample=44100,aformat=channel_layouts=stereo,volume=${x.vol},adelay=${ms}|${ms}[s${i}]`);
  });
  parts.push(`[a0]${sounds.map((_, i) => `[s${i}]`).join("")}amix=inputs=${sounds.length + 1}:duration=first:normalize=0,alimiter=limit=0.95[ao]`);
  const out = path.join(dir, "pro.mp4");
  args.push("-filter_complex", parts.join(";"), "-map", "[vo]", "-map", "[ao]", "-t", total.toFixed(3),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out);
  await ff(args, 240_000);
  return { bytes: await readFile(out), seconds: total };
}
