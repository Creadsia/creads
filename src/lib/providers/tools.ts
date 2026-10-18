import type { ToolDef, ToolId } from "../tools";
import { readFile, rm } from "node:fs/promises";
import { fetchableUrl, saveMedia } from "../media";
import { cutParts, download, joinParts, partsPlan, probe, still, workdir } from "../montage";
import { claude } from "./claude";
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
  /** personaje-en-video: the customer's own link to the video (signed again for the second step). */
  videoRef?: string;
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
export const toolConfigured = (t: ToolDef) => Boolean(ELEVEN.includes(t.id) ? process.env.ELEVENLABS_API_KEY : process.env.FAL_KEY);

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
// over 10 s it's done in parts. This way is steadier: (1) Claude picks the first moment the main person is
// clearly seen; (2) Nano Banana puts the character in that frame, in that person's place and pose, only once;
// (3) Kling Motion Control makes that picture repeat the video's movements and camera, in one go (up to 30 s).
// The video starts at that moment. Job id: "swap:<json>", step 1 (the picture) then step 2 (the video).

const SWAP = "swap:";
const MOTION = "fal-ai/kling-video/v3/standard/motion-control";
interface SwapJob { s: 1 | 2; snd: 0 | 1; v: string; j: string; p?: string; frame?: string }

export function swapFramePrompt(extra?: string) {
  return [
    "Image 1 is a frame from a real phone video. Image 2 is a reference sheet of ONE single fictional character seen from several angles (front, side, back and a face close-up): it is one person, not several.",
    "Edit image 1: replace ONLY the main person (the most prominent person, the one the video is about) with this character: exactly the same face, nose, hair, glasses, facial hair, body type and clothes as in image 2.",
    "Keep that person's exact pose, position, size in the frame and whatever they hold in their hands.",
    "Everything else stays identical to image 1: the place, the background, the light, the camera angle and every other person.",
    "There must be only ONE of this character in the picture. Do not add any object that is not in image 1. Photorealistic, same photo quality and grain as image 1, no text.",
    extra ? `Also: ${extra}` : "",
  ].filter(Boolean).join("\n");
}

const NO_BODY = "En este video la persona principal no aparece clara de la cintura para arriba (por ejemplo, está dentro de un auto o tapada). Usa un video donde se le vea de frente, con cabeza, hombros, brazos y torso. No se te cobró.";

/** The earliest of these frames where the main person's whole upper body is clearly seen (-1 if none, 0 if unsure). */
async function firstClearFrame(frames: string[]): Promise<number> {
  if (frames.length < 2 || !claude.configured()) return 0;
  try {
    const out = await claude.complete({
      fast: true, json: true, maxTokens: 1000, images: frames,
      prompt: `These are ${frames.length} frames of one video, in order (frame 0 to ${frames.length - 1}). Find the main person of the video (the one it is about, usually the one the camera follows). Answer the number of the EARLIEST frame where that main person's COMPLETE upper body is clearly visible: head, both shoulders, both arms and the torso down to the waist, all inside the picture, not inside a car, not behind a car door or any object, not cut by the edge, ideally standing and facing the camera. Being only partly out of a car does NOT count. If no frame shows it, answer -1. JSON: {"frame": number}`,
    });
    const n = Number(JSON.parse(out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1)).frame);
    return Number.isInteger(n) && n >= -1 && n < frames.length ? n : 0;
  } catch { return 0; }
}

async function startSwap(input: ToolInput, ws: string, what: string): Promise<string> {
  if (!input.videoRef) throw new Error("Falta el video.");
  const dir = await workdir(`swap-${Date.now().toString(36)}`);
  try {
    const src = `${dir}/src.mp4`;
    await download(input.video!, src);
    const dur = input.videoSecs || (await probe(src)).dur;
    // candidates along the video, one per second (the video must still last 3 s from there)
    const times = [0, 0.5, ...Array.from({ length: 14 }, (_, i) => i + 1)].filter((t) => t === 0 || t <= dur - 3.2);
    const small = await Promise.all(times.map(async (t, i) => { const f = `${dir}/c${i}.jpg`; await still(src, t, f, 360); return `data:image/jpeg;base64,${(await readFile(f)).toString("base64")}`; }));
    const pick = await firstClearFrame(small);
    if (pick < 0) throw new Error(NO_BODY); // before spending anything: the start refunds it
    const at = times[pick];
    await still(src, at, `${dir}/frame.jpg`, null);
    const frameUrl = await fetchableUrl(await saveMedia(ws, "tools/personaje", await readFile(`${dir}/frame.jpg`), "image/jpeg"), ws);
    // the video from that moment on, so the picture and the first frame of the motion match
    let videoRef = input.videoRef;
    if (at > 0) {
      const [cut] = await cutParts(dir, src, [{ a: at, len: +(dur - at).toFixed(3) }]);
      videoRef = await saveMedia(ws, "tools/partes", await readFile(cut), "video/mp4");
    }
    const j = await falSubmit("fal-ai/nano-banana-pro/edit", { prompt: swapFramePrompt(input.prompt), image_urls: [frameUrl, input.image], aspect_ratio: "auto", resolution: "2K", output_format: "png", num_images: 1 }, what);
    const job: SwapJob = { s: 1, snd: input.sound === false ? 0 : 1, v: videoRef, j, ...(input.prompt ? { p: input.prompt.slice(0, 600) } : {}) };
    return SWAP + JSON.stringify(job);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => null);
  }
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
        const video = await fetchableUrl(sj.v, ws);
        const j = await falSubmit(MOTION, { image_url: frame, video_url: video, character_orientation: "video", keep_original_sound: sj.snd === 1, ...(sj.p ? { prompt: sj.p } : {}) }, t.name)
          .catch((e: unknown) => {
            // Kling checks the picture for a full upper body: say it plainly
            if (/upper body|body detected|recognition failed/i.test(e instanceof Error ? e.message : "")) throw new Error("No se vio el cuerpo completo del personaje de la cintura para arriba en la escena. Prueba con un video donde la persona aparezca de frente y entera desde la cintura en algún momento. Te devolvimos los créditos.");
            throw e;
          });
        return SWAP + JSON.stringify({ ...sj, s: 2, j, frame } satisfies SwapJob);
      },
    };
  }
  const url = vid(r.out);
  if (!url) return { state: "failed", error: `${t.name}: no devolvió video.` };
  return {
    state: "done", mime: "video/mp4", ext: "mp4",
    fetch: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No se pudo descargar el resultado (${res.status}).`);
      return res.arrayBuffer();
    },
  };
}
