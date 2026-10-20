import { inline } from "./gemini";
import type { Job, JobStatus, VideoProvider } from "./types";

// Gemini Omni 1.1 Flash: Google's new video model on the Gemini API (Interactions API), the stated
// replacement for the Veo previews. Same GEMINI_API_KEY. Docs: ai.google.dev/gemini-api/docs/omni
// (checked 2026-10-20). About US$0.10 per second at 720p. It has no length setting (clips run up to
// about 10 s), only English prompts are fully evaluated, and there is no negative prompt.
const BASE = "https://generativelanguage.googleapis.com/v1beta";
const MODEL = "gemini-omni-1.1-flash";
const PREFIX = "omni:";
const ID = /^[\w-]+$/;

function key() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("Falta GEMINI_API_KEY en Vercel.");
  return k;
}
const headers = () => ({ "x-goog-api-key": key(), "content-type": "application/json" });

async function fail(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  throw new Error(`Gemini Omni: ${String(body?.error?.message ?? res.statusText).slice(0, 300)} (código ${res.status})`);
}

/** The interaction Google receives (exported for tests). Images are passed in already as base64. */
export function omniRequest(req: { prompt: string; seconds: number; aspect: string }, first?: { data: string; mimeType: string }, assets: { data: string; mimeType: string }[] = []) {
  if (req.aspect !== "9:16" && req.aspect !== "16:9") throw new Error("Gemini Omni solo hace videos 9:16 o 16:9.");
  const text = `${req.prompt}\n\nLength: about ${req.seconds} seconds.`;
  const images = [...(first ? [first] : []), ...assets].map((i) => ({ type: "image", data: i.data, mime_type: i.mimeType }));
  const task = first ? "image_to_video" : assets.length ? "reference_to_video" : "text_to_video";
  return {
    model: MODEL,
    input: images.length ? [...images, { type: "text", text }] : text,
    response_format: { type: "video", aspect_ratio: req.aspect, resolution: "720p" },
    generation_config: { video_config: { task } },
    background: true,
  };
}

type Interaction = { id?: string; status?: string; error?: { message?: string }; steps?: { type?: string; content?: { type?: string; data?: string; uri?: string }[] }[] };
const videoOf = (i: Interaction) => i.steps?.flatMap((s) => s.content ?? []).find((c) => c.type === "video");

async function read(id: string): Promise<Interaction> {
  if (!ID.test(id)) throw new Error("Trabajo inválido.");
  const res = await fetch(`${BASE}/interactions/${id}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) return fail(res);
  return res.json();
}

export const omniFlash: VideoProvider = {
  id: "gemini-omni-flash",
  label: "Gemini Omni Flash",
  usdPerSecond: 0.1, // 5,792 tokens per second of 720p at US$17.50 per million
  configured: () => Boolean(process.env.GEMINI_API_KEY),
  durations: [8],
  aspects: ["9:16", "16:9"],

  async submit(req) {
    const first = req.refs?.find((r) => r.role === "first_frame");
    const assets = (req.refs ?? []).filter((r) => r.role === "face" || r.role === "product").slice(0, 3);
    const body = omniRequest(req, first ? await inline(first) : undefined, await Promise.all(assets.map(inline)));
    const res = await fetch(`${BASE}/interactions`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
    if (!res.ok) return fail(res);
    const i: Interaction = await res.json();
    if (!i.id || !ID.test(i.id)) throw new Error("Gemini Omni no devolvió un trabajo.");
    return { provider: omniFlash.id, jobId: PREFIX + i.id };
  },

  async status(job: Job): Promise<JobStatus> {
    if (!job.jobId.startsWith(PREFIX)) return { state: "failed", error: "Trabajo inválido." };
    const i = await read(job.jobId.slice(PREFIX.length));
    if (i.status === "failed" || i.status === "cancelled") return { state: "failed", error: String(i.error?.message ?? "Gemini Omni no pudo hacer el video.").slice(0, 300) };
    if (i.status !== "completed") return { state: "running" };
    return videoOf(i) ? { state: "done", url: job.jobId } : { state: "failed", error: "Gemini Omni no devolvió video (puede ser un filtro de Google)." };
  },

  /** Reading the interaction again returns the video as base64. */
  async download(url: string) {
    if (!url.startsWith(PREFIX)) throw new Error("Enlace de video inesperado.");
    const v = videoOf(await read(url.slice(PREFIX.length)));
    if (v?.data) {
      const buf = Buffer.from(v.data, "base64");
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    }
    const file = v?.uri?.match(/files\/([\w-]+)/)?.[1];
    if (!file) throw new Error("No se pudo descargar el video de Gemini Omni.");
    const res = await fetch(`${BASE}/files/${file}:download?alt=media`, { headers: { "x-goog-api-key": key() }, redirect: "follow" });
    if (!res.ok) throw new Error(`No se pudo descargar el video (${res.status}).`);
    return res.arrayBuffer();
  },
};
