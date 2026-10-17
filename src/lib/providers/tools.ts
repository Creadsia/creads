import type { ToolDef, ToolId } from "../tools";
import { saveMedia } from "../media";
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
}

export type ToolCheck =
  | { state: "queued" | "running" }
  | { state: "failed"; error: string }
  | { state: "done"; fetch: () => Promise<ArrayBuffer>; mime: string; ext: string }
  | { state: "done"; url: string };

interface FalTool {
  endpoint: string;
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
    build: (i) => ({ prompt: videoEditPrompt(i.prompt ?? "", i.images?.length ?? 0), video_url: i.video, keep_audio: true, ...(i.images?.length ? { image_urls: i.images.slice(0, 4) } : {}) }),
    pick: vid,
  },
  "copiar-movimiento": {
    endpoint: "fal-ai/kling-video/v3/standard/motion-control",
    // "video": the character follows the reference video's motion and framing (up to 30 s)
    build: (i) => ({ image_url: i.image, video_url: i.video, character_orientation: "video", keep_original_sound: true, ...(i.prompt ? { prompt: i.prompt } : {}) }),
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
  return t ? { endpoint: t.endpoint, body: t.build(i) } : null;
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
  const f = FAL[t.id];
  if (!f) throw new Error("Herramienta desconocida.");
  return falSubmit(f.endpoint, f.build(input), t.name);
}

const extOf = (url: string, fallback: string) => {
  const m = new URL(url).pathname.match(/\.(png|jpe?g|webp|mp4|mov|webm)$/i);
  return m ? m[1].toLowerCase().replace("jpeg", "jpg") : fallback;
};
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mp3: "audio/mpeg" };

export async function checkTool(t: ToolDef, job: string): Promise<ToolCheck> {
  if (job.startsWith("url:")) return { state: "done", url: job.slice(4) };
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
