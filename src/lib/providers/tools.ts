import type { ToolDef, ToolId } from "../tools";
import { readFile, rm } from "node:fs/promises";
import { fetchableUrl, saveMedia } from "../media";
import { cutParts, download, joinParts, partsPlan, probe, still, stripAudio, workdir } from "../montage";
import { comfyConfigured, comfyPoll, comfySubmit, comfyVideo, GENJUTSU } from "./comfy";
import { type Analysis, type FaceKit, framePrompt, genjutsuPrompt, learnSwap, motionPrompt, reviewFrame, reviewVideo, swapRules } from "../influencer/swap";
import { compose, dubFile, dubStart, dubStatus, soundEffect } from "./elevenlabs";
import { falPoll, falSubmit } from "./fal";

// Runs the "Crear" tools (catalog in src/lib/tools.ts). Server-only. Every tool is a job:
// start() returns a job id, check() polls it and, when it's finished, says where to fetch the result.
// Schemas checked with fal's OpenAPI and ElevenLabs' docs on 2026-10-16.

export interface ToolInput {
  image?: string;
  images?: string[];
  video?: string;
  audio?: string;
  prompt?: string;
  target?: string;
  seconds?: number; // music / sound effects: chosen length
  instrumental?: boolean;
  /** editar-video / copiar-movimiento: keep the original video's sound (default true). */
  sound?: boolean;
  /** editar-video: the measured length of the video (over 10 s it's done in parts). */
  videoSecs?: number;
  /** personaje-en-video: the customer's own links (signed again at each step), the check made before charging
   *  and the character's face kit (media links). */
  videoRef?: string;
  imageRef?: string;
  analysis?: Analysis;
  face?: FaceKit | null;
}

export type ToolCheck =
  | { state: "queued" | "running"; /** a next step to start (once): returns the new job id */ advance?: () => Promise<string> }
  | { state: "failed"; error: string }
  | { state: "done"; fetch: () => Promise<ArrayBuffer>; mime: string; ext: string }
  | { state: "done"; url: string };

interface FalTool {
  endpoint: string | ((i: ToolInput) => string);
  build: (i: ToolInput) => Record<string, unknown>;
  /** Where the result file is in fal's answer. */
  pick: (out: Record<string, unknown>) => string | undefined;
}

type FileOut = { url?: string };
const img = (o: Record<string, unknown>) => (o.image as FileOut | undefined)?.url;
const imgs = (o: Record<string, unknown>) => (o.images as FileOut[] | undefined)?.[0]?.url;
const vid = (o: Record<string, unknown>) => (o.video as FileOut | undefined)?.url;

const FAL: Partial<Record<ToolId, FalTool>> = {
  "quitar-fondo": {
    endpoint: "fal-ai/bria/background/remove",
    build: (i) => ({ image_url: i.image, ...(i.prompt ? { prompt: i.prompt } : {}) }),
    pick: img,
  },
  "editar-imagen": {
    endpoint: "fal-ai/nano-banana-pro/edit",
    build: (i) => ({ prompt: i.prompt, image_urls: i.images, resolution: "1K", output_format: "png", num_images: 1 }),
    pick: imgs,
  },
  "mejorar-imagen": {
    endpoint: "fal-ai/seedvr/upscale/image",
    build: (i) => ({ image_url: i.image, upscale_mode: "factor", upscale_factor: 2, output_format: "png" }),
    pick: img,
  },
  "mejorar-video": {
    endpoint: "fal-ai/seedvr/upscale/video",
    build: (i) => ({ video_url: i.video, upscale_mode: "target", target_resolution: "1080p", output_format: "X264 (.mp4)", output_quality: "high" }),
    pick: vid,
  },
  "editar-video": {
    endpoint: "fal-ai/kling-video/o1/video-to-video/edit",
    build: (i) => ({ prompt: videoEditPrompt(i.prompt ?? "", i.images?.length ?? 0), video_url: i.video, keep_audio: i.sound !== false, ...(i.images?.length ? { image_urls: i.images.slice(0, 4) } : {}) }),
    pick: vid,
  },
  "crear-personaje": {
    // with reference photos the edit model takes them as guides; without, it draws from the description
    endpoint: (i) => (i.images?.length ? "fal-ai/nano-banana-pro/edit" : "fal-ai/nano-banana-pro"),
    build: (i) => ({ prompt: i.prompt, ...(i.images?.length ? { image_urls: i.images.slice(0, 4) } : {}), aspect_ratio: "16:9", resolution: "1K", output_format: "png", num_images: 1 }),
    pick: imgs,
  },
  "copiar-movimiento": {
    endpoint: "fal-ai/kling-video/v3/standard/motion-control",
    // "video": the character follows the reference video's motion and framing (up to 30 s)
    build: (i) => ({ image_url: i.image, video_url: i.video, character_orientation: "video", keep_original_sound: i.sound !== false, ...(i.prompt ? { prompt: i.prompt } : {}) }),
    pick: vid,
  },
  "avatar-habla": {
    endpoint: "bytedance/omnihuman/v2",
    build: (i) => ({ image_url: i.image, audio_url: i.audio, ...(i.prompt ? { prompt: i.prompt } : {}) }),
    pick: vid,
  },
  "sincronizar-labios": {
    endpoint: "fal-ai/kling-video/lipsync/audio-to-video",
    build: (i) => ({ video_url: i.video, audio_url: i.audio }),
    pick: vid,
  },
};

/**
 * Kling refers to reference photos as @Image1, @Image2…; customers write «foto 1». Translate, and if
 * they uploaded photos without naming them, point at them so they're not ignored.
 */
export function videoEditPrompt(p: string, photos: number) {
  let out = p.replace(/\b(?:foto|imagen|image|photo)\s*#?\s*([1-4])\b/gi, (_m, n) => `@Image${n}`).trim();
  if (photos && !/@Image\d/.test(out)) out += ` (${Array.from({ length: photos }, (_, i) => `@Image${i + 1}`).join(", ")})`;
  return out.slice(0, 2500);
}

/** The exact request each tool sends (exported for tests). */
export const toolRequest = (id: ToolId, i: ToolInput) => {
  const t = FAL[id];
  return t ? { endpoint: typeof t.endpoint === "function" ? t.endpoint(i) : t.endpoint, body: t.build(i) } : null;
};

const ELEVEN: ToolId[] = ["doblaje", "musica", "efectos"];
export const toolConfigured = (t: ToolDef) => (t.id === "personaje-genjutsu" ? comfyConfigured() : Boolean(ELEVEN.includes(t.id) ? process.env.ELEVENLABS_API_KEY : process.env.FAL_KEY));

/** Starts the tool. The job id says who runs it: a fal result link, or "el:<dub id>:<lang>". */
/** `ws`: the customer workspace (results that come back at once are saved in its private folder). */
export async function startTool(t: ToolDef, input: ToolInput, ws: string): Promise<string> {
  // Music and sound effects come back in one call: store the file now; the job id is its link.
  if (t.id === "musica" || t.id === "efectos") {
    const secs = input.seconds ?? 15;
    const bytes = t.id === "musica" ? await compose(input.prompt!, secs, Boolean(input.instrumental)) : await soundEffect(input.prompt!, secs);
    return `url:${await saveMedia(ws, `tools/${t.id}`, bytes, "audio/mpeg")}`;
  }
  if (t.id === "doblaje") {
    const lang = input.target ?? "es";
    const id = await dubStart(input.video!, lang, `Creads · ${lang}`);
    return `el:${id}:${lang}`;
  }
  if (t.id === "personaje-en-video") return startSwap(input, ws, t.name);
  if (t.id === "personaje-genjutsu") return startGenjutsu(input, ws, t.name);
  const f = FAL[t.id];
  if (!f) throw new Error("Herramienta desconocida.");
  if (t.id === "editar-video" && (input.videoSecs ?? 0) > EDIT_MAX) return startInParts(f, input, ws, t.name);
  return falSubmit(typeof f.endpoint === "function" ? f.endpoint(input) : f.endpoint, f.build(input), t.name);
}

const extOf = (url: string, fallback: string) => {
  const m = new URL(url).pathname.match(/\.(png|jpe?g|webp|mp4|mov|webm)$/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : fallback;
};
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mp3: "audio/mpeg" };

export async function checkTool(t: ToolDef, job: string, ws = ""): Promise<ToolCheck> {
  if (job.startsWith("url:")) return { state: "done", url: job.slice(4) };
  if (job.startsWith(PARTS)) return checkParts(t, job);
  if (job.startsWith(SWAP)) return checkSwap(t, job, ws);
  if (job.startsWith(GJ)) return checkGenjutsu(t, job, ws);
  if (job.startsWith("el:")) {
    const [, id, lang] = job.split(":");
    const st = await dubStatus(id);
    if (st.state !== "done") return st;
    const ext = st.mime.includes("audio") ? "mp3" : "mp4";
    return { state: "done", mime: MIME[ext], ext, fetch: () => dubFile(id, lang) };
  }
  const f = FAL[t.id];
  if (!f) return { state: "failed", error: "Herramienta desconocida." };
  const r = await falPoll(job, t.name);
  if (r.state !== "done") return r;
  const url = f.pick(r.out);
  if (!url) return { state: "failed", error: `${t.name}: no devolvió ${t.output === "image" ? "imagen" : "video"}.` };
  const ext = extOf(url, t.output === "image" ? "png" : "mp4");
  return {
    state: "done",
    mime: MIME[ext] ?? "application/octet-stream",
    ext,
    fetch: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No se pudo descargar el resultado (${res.status}).`);
      return res.arrayBuffer();
    },
  };
}

// ---------------------------------------------------------------- long videos in parts (Editar video)
// The edit model takes at most 10 s. A longer video (up to 30 s) is cut into equal parts, each part is edited
// with the same instruction and photos (all at once), and the results are joined back into one video.
// The job id carries every part's job: "parts:<1|0 sound>:<json list>".

const EDIT_MAX = 10.05;
const PARTS = "parts:";

async function startInParts(f: FalTool, input: ToolInput, ws: string, what: string): Promise<string> {
  const dir = await workdir(`parts-${Date.now().toString(36)}`);
  try {
    const src = `${dir}/src.mp4`;
    await download(input.video!, src);
    const files = await cutParts(dir, src, partsPlan(input.videoSecs!));
    const urls = await Promise.all(files.map(async (file) => fetchableUrl(await saveMedia(ws, "tools/partes", await readFile(file), "video/mp4"), ws)));
    const jobs = await Promise.all(urls.map((video) => falSubmit(typeof f.endpoint === "function" ? f.endpoint({ ...input, video }) : f.endpoint, f.build({ ...input, video }), what)));
    return `${PARTS}${input.sound === false ? 0 : 1}:${JSON.stringify(jobs)}`;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => null);
  }
}

async function checkParts(t: ToolDef, job: string): Promise<ToolCheck> {
  const m = job.match(/^parts:([01]):(\[.*\])$/);
  const f = FAL[t.id];
  if (!m || !f) return { state: "failed", error: "Trabajo inválido." };
  const jobs = JSON.parse(m[2]) as string[];
  const st = await Promise.all(jobs.map((j) => falPoll(j, t.name)));
  const bad = st.find((x) => x.state === "failed");
  if (bad && bad.state === "failed") return bad;
  if (st.some((x) => x.state === "queued")) return { state: "queued" };
  if (st.some((x) => x.state !== "done")) return { state: "running" };
  const urls = st.map((x) => (x.state === "done" ? f.pick(x.out) : undefined));
  if (urls.some((u) => !u)) return { state: "failed", error: `${t.name}: una parte no devolvió video.` };
  return {
    state: "done", mime: "video/mp4", ext: "mp4",
    fetch: async () => {
      const dir = await workdir(`join-${Date.now().toString(36)}`);
      try {
        const files = await Promise.all(urls.map(async (u, i) => { const file = `${dir}/r${i}.mp4`; await download(u!, file); return file; }));
        const out = await joinParts(dir, files, m[1] === "1");
        return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => null);
      }
    },
  };
}

// ---------------------------------------------------------------- your character in a video (personaje-en-video)
// Swapping the person straight in the video (Editar video) duplicates the character and invents objects, and
// over 10 s it's done in parts. This way is steadier (see lib/influencer/swap.ts for the checks):
//  1. the picture: Nano Banana puts the character in the first frame where the main person is clearly seen
//     (found by the check before charging), only once, with the face from its face kit;
//  2. a review of that picture (redone once, free, if it's wrong; refunded if it's still wrong);
//  3. Kling Motion Control makes the picture repeat the video's movements in one go, the face locked (@Element1);
//  4. a review of the video (redone once, free, if it's wrong).
// Job id: "swap:<json>". Files are kept as the customer's media links and signed again at each step.

const SWAP = "swap:";
const MOTION = "fal-ai/kling-video/v3/standard/motion-control";
interface SwapJob {
  s: 1 | 2; snd: 0 | 1;
  /** the video (from the usable start), the original frame, the character's sheet, its face kit */
  v: string; of: string; sh: string; fk?: FaceKit | null;
  j: string; p?: string; main?: string; frame?: string;
  r1?: number; r2?: number; q1?: string[]; q2?: string[]; qa?: "ok" | "aviso";
}

/** Kept for the tests and other callers: the scene instruction with the defaults. */
export const swapFramePrompt = (extra?: string) => framePrompt({ extra });

const nanoBody = (frame: string, sheet: string, face: string | undefined, prompt: string) =>
  ({ prompt, image_urls: [frame, sheet, ...(face ? [face] : [])], aspect_ratio: "auto", resolution: "2K", output_format: "png", num_images: 1 });

async function startSwap(input: ToolInput, ws: string, what: string): Promise<string> {
  if (!input.videoRef || !input.imageRef) throw new Error("Falta el video o el personaje.");
  const a = input.analysis;
  if (a && a.level === "rojo") throw new Error(a.checks.find((c) => c.level === "rojo")?.text ?? "Este video no sirve para esto.");
  const dir = await workdir(`swap-${Date.now().toString(36)}`);
  try {
    const src = `${dir}/src.mp4`;
    await download(input.video!, src);
    const dur = input.videoSecs || (await probe(src)).dur;
    const start = a?.start ?? 0;
    const len = a?.usable ? Math.min(a.usable, dur - start) : dur - start;
    await still(src, start, `${dir}/frame.jpg`, null);
    const of = await saveMedia(ws, "tools/personaje", await readFile(`${dir}/frame.jpg`), "image/jpeg");
    // the video from that moment, only the first shot: the picture and the motion's first frame match
    let v = input.videoRef;
    if (start > 0 || len < dur - 0.15) {
      const [cut] = await cutParts(dir, src, [{ a: start, len: +len.toFixed(3) }]);
      v = await saveMedia(ws, "tools/partes", await readFile(cut), "video/mp4");
    }
    const fk = input.face ?? null;
    const rules = await swapRules();
    const prompt = framePrompt({ extra: input.prompt, main: a?.main, withFace: Boolean(fk), rules });
    const j = await falSubmit("fal-ai/nano-banana-pro/edit", nanoBody(await fetchableUrl(of, ws), input.image!, fk ? await fetchableUrl(fk.front, ws) : undefined, prompt), what);
    const job: SwapJob = { s: 1, snd: input.sound === false ? 0 : 1, v, of, sh: input.imageRef, fk, j, ...(input.prompt ? { p: input.prompt.slice(0, 600) } : {}), ...(a?.main ? { main: a.main.slice(0, 160) } : {}) };
    return SWAP + JSON.stringify(job);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => null);
  }
}

const BAD_SCENE = "No logramos poner al personaje en la escena sin errores con este video (lo intentamos dos veces). Prueba con un video donde la persona se vea más grande, de frente y sola. Te devolvimos los créditos.";
const BODY_ERR = "No se vio el cuerpo completo del personaje de la cintura para arriba en la escena. Prueba con un video donde la persona aparezca de frente y entera desde la cintura. Te devolvimos los créditos.";

async function submitMotion(sj: SwapJob, frame: string, ws: string, what: string, fix?: string[]) {
  const video = await fetchableUrl(sj.v, ws);
  const fk = sj.fk;
  const front = fk ? await fetchableUrl(fk.front, ws) : null;
  const refs = fk ? await Promise.all((fk.refs.length ? fk.refs : [sj.sh]).map((r) => fetchableUrl(r, ws))) : [];
  const prompt = motionPrompt({ extra: sj.p, withFace: Boolean(front), fix, rules: await swapRules() });
  return falSubmit(MOTION, {
    image_url: frame, video_url: video, character_orientation: "video", keep_original_sound: sj.snd === 1, prompt,
    ...(front ? { elements: [{ frontal_image_url: front, reference_image_urls: refs.slice(0, 3) }] } : {}),
  }, what).catch((e: unknown) => {
    // Kling checks the picture for a full upper body: say it plainly
    if (/upper body|body detected|recognition failed/i.test(e instanceof Error ? e.message : "")) throw new Error(BODY_ERR);
    throw e;
  });
}

async function checkSwap(t: ToolDef, job: string, ws: string): Promise<ToolCheck> {
  let sj: SwapJob;
  try { sj = JSON.parse(job.slice(SWAP.length)) as SwapJob; } catch { return { state: "failed", error: "Trabajo inválido." }; }
  const r = await falPoll(sj.j, t.name);
  if (r.state !== "done") return r;

  if (sj.s === 1) {
    const frame = imgs(r.out) ?? img(r.out);
    if (!frame) return { state: "failed", error: `${t.name}: no se pudo poner al personaje en la escena.` };
    return {
      state: "running",
      advance: async () => {
        const rev = await reviewFrame(await fetchableUrl(sj.of, ws), frame, await fetchableUrl(sj.sh, ws));
        if (rev.severe) {
          await learnSwap(rev.issues);
          if ((sj.r1 ?? 0) >= 1) throw new Error(BAD_SCENE);
          // once more, free, telling it what went wrong
          const prompt = framePrompt({ extra: sj.p, main: sj.main, withFace: Boolean(sj.fk), fix: rev.issues, rules: await swapRules() });
          const j = await falSubmit("fal-ai/nano-banana-pro/edit", nanoBody(await fetchableUrl(sj.of, ws), await fetchableUrl(sj.sh, ws), sj.fk ? await fetchableUrl(sj.fk.front, ws) : undefined, prompt), t.name);
          return SWAP + JSON.stringify({ ...sj, j, r1: (sj.r1 ?? 0) + 1, q1: rev.issues } satisfies SwapJob);
        }
        const j = await submitMotion(sj, frame, ws, t.name);
        return SWAP + JSON.stringify({ ...sj, s: 2, j, frame } satisfies SwapJob);
      },
    };
  }

  const url = vid(r.out);
  if (!url) return { state: "failed", error: `${t.name}: no devolvió video.` };
  if (!sj.qa) {
    return {
      state: "running",
      advance: async () => {
        const rev = await reviewVideo(url, await fetchableUrl(sj.sh, ws), await fetchableUrl(sj.v, ws));
        if (rev.severe) await learnSwap(rev.issues);
        if (rev.severe && (sj.r2 ?? 0) < 1 && sj.frame) {
          const j = await submitMotion(sj, sj.frame, ws, t.name, rev.issues);
          return SWAP + JSON.stringify({ ...sj, j, r2: (sj.r2 ?? 0) + 1, q2: rev.issues } satisfies SwapJob);
        }
        return SWAP + JSON.stringify({ ...sj, qa: rev.severe ? "aviso" : "ok", ...(rev.issues.length ? { q2: rev.issues } : {}) } satisfies SwapJob);
      },
    };
  }
  return {
    state: "done", mime: "video/mp4", ext: "mp4",
    fetch: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No se pudo descargar el resultado (${res.status}).`);
      return res.arrayBuffer();
    },
  };
}

/** What a «Mi personaje en un video» job is doing now, for the customer (null for other jobs). */
export function swapStep(job: string): string | null {
  if (job.startsWith(GJ)) {
    try { return (JSON.parse(job.slice(GJ.length)) as GjJob).r ? "Rehaciendo el video (gratis): la revisión encontró un detalle…" : "Tu personaje está entrando al video (tarda unos minutos)…"; } catch { return null; }
  }
  if (!job.startsWith(SWAP)) return null;
  try {
    const sj = JSON.parse(job.slice(SWAP.length)) as SwapJob;
    if (sj.s === 1) return sj.r1 ? "Rehaciendo la escena (gratis): la revisión encontró un detalle…" : "Paso 1 de 3: poniendo a tu personaje en la escena…";
    return sj.r2 ? "Rehaciendo el video (gratis): la revisión encontró un detalle…" : "Paso 2 de 3: copiando los movimientos del video…";
  } catch { return null; }
}

// ---------------------------------------------------------------- máxima calidad: Genjutsu (personaje-genjutsu)
// Higgsfield's Genjutsu through Comfy Router: recasts the main person of the whole video (same camera, timing,
// background, other people and sound), with the character's clean references (its front body and face cut
// out of the sheet, never the 4-view sheet itself, which could become 4 people). Then the same review as the
// standard way: a severe problem is redone once, free. Job id: "gj:<json>".

const GJ = "gj:";
interface GjJob {
  id: string; snd: 0 | 1;
  /** the video, the character's sheet and the reference pictures (customer's media links) */
  v: string; sh: string; imgs: string[];
  p?: string; main?: string; r?: number; q?: string[]; qa?: "ok" | "aviso";
}

async function submitGenjutsu(j: Omit<GjJob, "id">, ws: string, what: string, fix?: string[]) {
  const image_urls = await Promise.all(j.imgs.map((r) => fetchableUrl(r, ws)));
  return comfySubmit(GENJUTSU, {
    image_urls, video_url: await fetchableUrl(j.v, ws), resolution: "720p",
    prompt: genjutsuPrompt({ extra: j.p, main: j.main, withFace: j.imgs.length > 1, fix, rules: await swapRules() }),
  }, what);
}

async function startGenjutsu(input: ToolInput, ws: string, what: string): Promise<string> {
  if (!input.videoRef || !input.imageRef) throw new Error("Falta el video o el personaje.");
  const fk = input.face;
  // the whole character first, then its face; a plain photo (not a saved character) goes as it is
  const imgs = fk ? [...(fk.refs.length ? [fk.refs[0]] : []), fk.front] : [input.imageRef];
  const base: Omit<GjJob, "id"> = { snd: input.sound === false ? 0 : 1, v: input.videoRef, sh: input.imageRef, imgs, ...(input.prompt ? { p: input.prompt.slice(0, 600) } : {}), ...(input.analysis?.main ? { main: input.analysis.main.slice(0, 160) } : {}) };
  const id = await submitGenjutsu(base, ws, what);
  return GJ + JSON.stringify({ ...base, id } satisfies GjJob);
}

async function checkGenjutsu(t: ToolDef, job: string, ws: string): Promise<ToolCheck> {
  let j: GjJob;
  try { j = JSON.parse(job.slice(GJ.length)) as GjJob; } catch { return { state: "failed", error: "Trabajo inválido." }; }
  const r = await comfyPoll(GENJUTSU, j.id, t.name);
  if (r.state !== "done") return r;
  const url = comfyVideo(r.out);
  if (!url) return { state: "failed", error: `${t.name}: no devolvió video.` };
  if (!j.qa) {
    return {
      state: "running",
      advance: async () => {
        const rev = await reviewVideo(url, await fetchableUrl(j.sh, ws), await fetchableUrl(j.v, ws));
        if (rev.severe) await learnSwap(rev.issues);
        if (rev.severe && !j.r) {
          const id = await submitGenjutsu(j, ws, t.name, rev.issues);
          return GJ + JSON.stringify({ ...j, id, r: 1, q: rev.issues } satisfies GjJob);
        }
        return GJ + JSON.stringify({ ...j, qa: rev.severe ? "aviso" : "ok", ...(rev.issues.length ? { q: rev.issues } : {}) } satisfies GjJob);
      },
    };
  }
  return {
    state: "done", mime: "video/mp4", ext: "mp4",
    fetch: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No se pudo descargar el resultado (${res.status}).`);
      const bytes = await res.arrayBuffer();
      if (j.snd === 1) return bytes;
      // silent: the same picture without its sound
      const dir = await workdir(`gj-${Date.now().toString(36)}`);
      try {
        const { writeFile } = await import("node:fs/promises");
        await writeFile(`${dir}/in.mp4`, Buffer.from(bytes));
        const out = await stripAudio(dir, `${dir}/in.mp4`);
        return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength) as ArrayBuffer;
      } finally {
        await rm(dir, { recursive: true, force: true }).catch(() => null);
      }
    },
  };
}
