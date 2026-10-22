import { fitPrompt, promptLimitFrom } from "../fit-prompt";
import type { AspectRatio, ImageProvider, ImageRequest, Job, JobStatus, VideoProvider, VideoRequest } from "./types";

// fal.ai queue API: one account gives us Kling, Seedance and many more. Server-only.
// Schemas checked with fal's OpenAPI on 2026-10-15. Prices: fal model pages (audio on, 720p) — the
// studio replaces them with fal's live pricing when available (see pricing()).
const QUEUE = "https://queue.fal.run";

function key() {
  const k = process.env.FAL_KEY;
  if (!k) throw new Error("Falta FAL_KEY en Vercel.");
  return k;
}
const auth = () => ({ authorization: `Key ${key()}` });

/** Turns a provider's refusal into something a marketer can act on. */
export function plainError(what: string, msg: string) {
  if (/likeness(es)? of real people|real (person|people)|private information/i.test(msg)) {
    return `${what} no acepta fotos de personas reales (como la cara de tu avatar). Reintenta este corte con Veo 3.1 Fast o Kling 3.0.`;
  }
  return `${what}: ${msg.slice(0, 300)}`;
}

async function fail(res: Response, what: string): Promise<never> {
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((d) => d?.msg).join("; ") : res.statusText;
  const plain = plainError(what, String(msg));
  throw new Error(plain.startsWith(`${what}: `) ? `${plain} (código ${res.status})` : plain);
}

type Build = (req: VideoRequest, image?: string) => Record<string, unknown>;

interface FalVideo {
  id: string;
  label: string;
  usdPerSecond: number;
  i2v: string; // image-to-video endpoint
  t2v?: string; // text-to-video endpoint (when no first frame)
  durations: number[];
  aspects?: AspectRatio[];
  silent?: boolean;
  /** Longest prompt the model takes (characters). Longer ones are shortened, keeping the dialogue. */
  maxPrompt?: number;
  /** Refuses starting images showing a real person's face (ByteDance's privacy filter). */
  noFaces?: boolean;
  /** fal's live price list only works for flat per-second prices; tiered models keep our static 720p price. */
  livePrice?: boolean;
  /** Image + recorded voice → talking video (the clip lasts as long as the voice). */
  talking?: boolean;
  /** Video of a real person + recorded voice → the same video with the voice on its lips (no generation). */
  actor?: boolean;
  build: Build;
}

const nearest = (n: number, list: number[]) => list.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Seedance has no 4:5; 3:4 is the closest vertical feed format.
const seedAspect = (a: AspectRatio) => (a === "4:5" ? "3:4" : a);

const kling: Build = (req, image) => ({
  prompt: req.prompt,
  duration: String(nearest(req.seconds, range(3, 15))),
  generate_audio: req.withAudio,
  ...(image ? { start_image_url: image } : { aspect_ratio: req.aspect === "16:9" || req.aspect === "1:1" ? req.aspect : "9:16" }),
});

const seedance: Build = (req, image) => ({
  prompt: req.prompt,
  duration: String(nearest(req.seconds, range(4, 15))),
  aspect_ratio: image ? "auto" : seedAspect(req.aspect),
  resolution: req.resolution,
  generate_audio: req.withAudio,
  ...(image ? { image_url: image } : {}),
});

// Kling 3.0 Turbo (Pro quality, faster). No sound option.
const klingTurbo: Build = (req, image) => ({
  prompt: req.prompt,
  duration: String(nearest(req.seconds, range(3, 15))),
  ...(image ? { image_url: image } : { aspect_ratio: req.aspect === "16:9" || req.aspect === "1:1" ? req.aspect : "9:16" }),
});

// Hailuo 2.3 Pro: 1080p, fixed length (about 6 s), from an image.
const hailuoPro: Build = (req, image) => ({ prompt: req.prompt, prompt_optimizer: true, image_url: image });

// Hailuo 2.3 animates a starting image (its text-only mode is horizontal only). No sound.
const hailuo: Build = (req, image) => ({
  prompt: req.prompt,
  duration: String(nearest(req.seconds, [6, 10])),
  prompt_optimizer: true,
  image_url: image,
});

// Wan 3.0 (Alibaba): 2–30 s, with sound, 480p/720p/1080p.
const wan: Build = (req, image) => ({
  prompt: req.prompt,
  duration: nearest(req.seconds, range(2, 15)),
  resolution: req.resolution,
  aspect_ratio: image ? "adaptive" : seedAspect(req.aspect),
  audio: req.withAudio,
  enable_prompt_expansion: false, // keep the director's prompt as written
  ...(image ? { start_image_url: image } : {}),
});

// Kling AI Avatar 2 (Pro): the presenter's picture talks with the recorded voice, in one step (no second
// lip-sync pass). The prompt only guides delivery; the words come from the audio.
const klingAvatar: Build = (req, image) => ({
  image_url: image,
  audio_url: req.refs?.find((r) => r.role === "audio")?.url,
  prompt: "A real person talking to their phone camera in a casual UGC video: natural, relaxed delivery, subtle facial expressions, small natural head movements and occasional hand gestures in rhythm with the speech, natural blinking. Not exaggerated, not theatrical.",
});

// MiniMax H3 Max (fal, 2026-10): 5–15 s, 768p, follows the starting image's aspect. The prompt is used as
// written (no expansion): the director already wrote it, and the scene comes from the opening frame.
const minimax: Build = (req, image) => ({
  prompt: req.prompt,
  prompt_expansion_mode: "disabled",
  duration: nearest(req.seconds, range(5, 15)),
  resolution: "768P",
  ...(image ? { image_url: image } : { aspect_ratio: req.aspect === "4:5" ? "3:4" : req.aspect }),
});

// sync-3 (sync.so, on fal): the person's own filmed video with the approved voice on their lips. The video
// part we send is already cut to the voice's length, so nothing gets cut off.
const actorSync: Build = (req) => ({
  video_url: req.refs?.find((r) => r.role === "video")?.url,
  audio_url: req.refs?.find((r) => r.role === "audio")?.url,
  sync_mode: "cut_off",
});

// Grok Imagine Video 1.5 (xAI): 1–15 s.
const grok: Build = (req, image) => ({
  prompt: req.prompt,
  duration: nearest(req.seconds, range(1, 15)),
  resolution: req.resolution,
  ...(image ? { image_url: image } : { aspect_ratio: seedAspect(req.aspect) }),
});

export const FAL_VIDEO: FalVideo[] = [
  {
    id: "kling-3.0",
    maxPrompt: 2500,
    label: "Kling 3.0",
    usdPerSecond: 0.14,
    i2v: "fal-ai/kling-video/v3/standard/image-to-video",
    t2v: "fal-ai/kling-video/v3/standard/text-to-video",
    durations: range(3, 15),
    build: kling,
  },
  {
    id: "kling-3.0-pro",
    maxPrompt: 2500,
    label: "Kling 3.0 Pro",
    usdPerSecond: 0.168, // fal page 2026-10-16: $0.112 audio off, $0.168 audio on (we generate with audio)
    i2v: "fal-ai/kling-video/v3/pro/image-to-video",
    t2v: "fal-ai/kling-video/v3/pro/text-to-video",
    durations: range(3, 15),
    build: kling,
  },
  {
    id: "kling-3.0-turbo",
    maxPrompt: 2500,
    silent: true,
    label: "Kling 3.0 Turbo",
    usdPerSecond: 0.14,
    i2v: "fal-ai/kling-video/v3/turbo/pro/image-to-video",
    t2v: "fal-ai/kling-video/v3/turbo/pro/text-to-video",
    durations: range(3, 15),
    aspects: ["9:16", "1:1", "16:9"],
    build: klingTurbo,
  },
  {
    id: "seedance-2.0-fast",
    noFaces: true,
    label: "Seedance 2.0 Fast",
    usdPerSecond: 0.2419,
    i2v: "bytedance/seedance-2.0/fast/image-to-video",
    t2v: "bytedance/seedance-2.0/fast/text-to-video",
    durations: range(4, 15),
    build: seedance,
  },
  {
    id: "seedance-2.0",
    noFaces: true,
    label: "Seedance 2.0",
    usdPerSecond: 0.3024,
    i2v: "bytedance/seedance-2.0/image-to-video",
    t2v: "bytedance/seedance-2.0/text-to-video",
    durations: range(4, 15),
    build: seedance,
  },
  {
    id: "seedance-2.5",
    noFaces: true,
    label: "Seedance 2.5",
    usdPerSecond: 0.462, // $0.0214 per 1k tokens at 720p
    i2v: "bytedance/seedance-2.5/image-to-video",
    t2v: "bytedance/seedance-2.5/text-to-video",
    durations: range(4, 15),
    build: seedance,
  },
  {
    id: "hailuo-2.3",
    silent: true,
    label: "Hailuo 2.3",
    usdPerSecond: 0.056, // $0.28 per 6 s, $0.56 per 10 s
    i2v: "fal-ai/minimax/hailuo-2.3/standard/image-to-video",
    durations: [6, 10],
    livePrice: false,
    build: hailuo,
  },
  {
    id: "hailuo-2.3-pro",
    silent: true,
    label: "Hailuo 2.3 Pro",
    usdPerSecond: 0.082, // $0.49 per clip (~6 s, 1080p)
    i2v: "fal-ai/minimax/hailuo-2.3/pro/image-to-video",
    durations: [6],
    livePrice: false,
    build: hailuoPro,
  },
  {
    id: "wan-3.0",
    label: "Wan 3.0",
    usdPerSecond: 0.1, // 720p ($0.05 at 480p, $0.20 at 1080p)
    i2v: "alibaba/wan-3.0/image-to-video",
    t2v: "alibaba/wan-3.0/text-to-video",
    durations: [3, 4, 5, 6, 8, 10, 12, 15],
    livePrice: false,
    build: wan,
  },
  {
    // Seedance 2.0 Mini (fal, 2026-10): $0.1547/s at 720p ($0.0721 at 480p). Scenes without real faces only.
    id: "seedance-2.0-mini",
    noFaces: true, // tested 2026-10-21: refused the avatar's real face twice (like the other Seedance)
    label: "Seedance 2.0 Mini",
    usdPerSecond: 0.1547,
    i2v: "bytedance/seedance-2.0/mini/image-to-video",
    t2v: "bytedance/seedance-2.0/mini/text-to-video",
    durations: range(4, 15),
    livePrice: false,
    build: seedance,
  },
  {
    id: "kling-avatar-2-pro",
    label: "Kling Avatar 2 Pro · avatar que habla",
    usdPerSecond: 0.115, // fal 2026-10-21: $0.115 per second of video
    i2v: "fal-ai/kling-video/ai-avatar/v2/pro",
    durations: range(3, 15),
    talking: true,
    build: klingAvatar,
  },
  {
    // «Persona IA»: the scene comes from the opening frame (the avatar where the customer asked: a mall,
    // their kitchen…); the approved voice is lip-synced on top afterwards (sync-3).
    id: "minimax-h3-max",
    label: "MiniMax H3 Max · persona IA",
    usdPerSecond: 0.08, // fal 2026-10: $0.08/s at 768p ($0.05 at 480p, $0.16 at 1080p)
    i2v: "minimax/h3-max/image-to-video",
    t2v: "minimax/h3-max/text-to-video",
    durations: range(5, 15),
    livePrice: false,
    build: minimax,
  },
  {
    // «Persona real»: no video is generated; sync-3 puts the voice on the filmed person's lips.
    id: "persona-real",
    label: "Persona real · tu video",
    usdPerSecond: 0.1334, // fal 2026-10: sync-3 $8 per minute
    i2v: "fal-ai/sync-lipsync/v3",
    durations: range(3, 15),
    livePrice: false,
    actor: true,
    build: actorSync,
  },
  {
    id: "grok-video-1.5",
    label: "Grok Imagine Video 1.5",
    usdPerSecond: 0.14, // 720p ($0.08 at 480p, $0.25 at 1080p)
    i2v: "xai/grok-imagine-video/v1.5/image-to-video",
    t2v: "xai/grok-imagine-video/v1.5/text-to-video",
    durations: [3, 4, 5, 6, 8, 10, 12, 15],
    livePrice: false,
    build: grok,
  },
];

const RESULT = /^https:\/\/queue\.fal\.run\/[\w./-]+\/requests\/[\w-]+$/;

/** Starts any fal job on the queue; returns the job's result link, which we use as the job id. */
export async function falSubmit(endpoint: string, body: Record<string, unknown>, what: string): Promise<string> {
  const res = await fetch(`${QUEUE}/${endpoint}`, {
    method: "POST",
    headers: { ...auth(), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return fail(res, what);
  const data = await res.json();
  if (!data?.response_url) throw new Error(`${what}: no devolvió un trabajo.`);
  return data.response_url as string;
}

/** Checks a fal job. When it's finished, returns fal's output object. */
export async function falPoll(
  jobUrl: string,
  what: string,
): Promise<{ state: "queued" | "running" } | { state: "failed"; error: string } | { state: "done"; out: Record<string, unknown> }> {
  if (!RESULT.test(jobUrl)) return { state: "failed", error: "Trabajo inválido." };
  const st = await fetch(`${jobUrl}/status`, { headers: auth() });
  if (!st.ok) return fail(st, what);
  const s = await st.json();
  if (s.status === "IN_QUEUE") return { state: "queued" };
  if (s.status !== "COMPLETED") return { state: "running" };
  const res = await fetch(jobUrl, { headers: auth() });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const d = body?.detail;
    const msg = typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x?.msg).join("; ") : `código ${res.status}`;
    return { state: "failed", error: plainError(what, String(msg)) };
  }
  return { state: "done", out: await res.json() };
}

function falVideo(m: FalVideo): VideoProvider {
  return {
    id: m.id,
    label: m.label,
    usdPerSecond: m.usdPerSecond,
    configured: () => Boolean(process.env.FAL_KEY),
    durations: m.durations.filter((d) => [3, 4, 5, 6, 8, 10, 12, 15].includes(d)),
    aspects: m.aspects ?? ["9:16", "4:5", "1:1", "16:9"],
    needsImage: !m.t2v,
    silent: Boolean(m.silent),
    noFaces: Boolean(m.noFaces),
    talking: Boolean(m.talking),
    actor: Boolean(m.actor),

    async submit(req) {
      if (m.actor) {
        if (!req.refs?.some((r) => r.role === "video") || !req.refs?.some((r) => r.role === "audio")) throw new Error(`${m.label} necesita el video de la persona y la voz grabada.`);
        return { provider: m.id, jobId: await falSubmit(m.i2v, m.build(req), m.label) };
      }
      const image = req.refs?.find((r) => r.role === "first_frame")?.url;
      const endpoint = image ? m.i2v : m.t2v;
      if (!endpoint) throw new Error(`${m.label} necesita una imagen de partida.`);
      if (m.talking && !req.refs?.some((r) => r.role === "audio")) throw new Error(`${m.label} necesita la voz grabada.`);
      const go = async (prompt: string) => ({ provider: m.id, jobId: await falSubmit(endpoint, m.build({ ...req, prompt }, image), m.label) });
      try {
        return await go(m.maxPrompt ? await fitPrompt(req.prompt, m.maxPrompt) : req.prompt);
      } catch (err) {
        // a model with a limit we didn't know about: shorten to it and try once more
        const limit = promptLimitFrom(err instanceof Error ? err.message : "");
        if (!limit) throw err;
        return go(await fitPrompt(req.prompt, limit - 20));
      }
    },

    async status(job: Job): Promise<JobStatus> {
      const r = await falPoll(job.jobId, m.label);
      if (r.state !== "done") return r;
      const url = (r.out.video as { url?: string } | undefined)?.url;
      if (!url) return { state: "failed", error: `${m.label} no devolvió video.` };
      return { state: "done", url };
    },
  };
}

export const falVideoProviders = FAL_VIDEO.map(falVideo);

/**
 * Live prices from fal's platform API, keyed by our model id (US$ per second of video, image-to-video endpoint).
 * Returns {} if the API is unavailable; callers fall back to the static prices above.
 */
export async function falPricing(): Promise<Record<string, { usd: number; unit: string }>> {
  if (!process.env.FAL_KEY) return {};
  const priced = FAL_VIDEO.filter((m) => m.livePrice !== false);
  const qs = priced.map((m) => `endpoint_id=${encodeURIComponent(m.i2v)}`).join("&");
  try {
    const res = await fetch(`https://api.fal.ai/v1/models/pricing?${qs}`, { headers: auth(), next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const data = await res.json();
    const out: Record<string, { usd: number; unit: string }> = {};
    for (const p of data?.prices ?? []) {
      const m = priced.find((x) => x.i2v === p.endpoint_id);
      if (m && typeof p.unit_price === "number") out[m.id] = { usd: p.unit_price, unit: String(p.unit ?? "") };
    }
    return out;
  } catch {
    return {};
  }
}


// ---------- images ----------
// Image models on fal, called with the synchronous endpoint (an image takes seconds).
// With face/product references they switch to the model's edit endpoint.
const SYNC = "https://fal.run";

interface FalImage {
  id: string;
  label: string;
  usdPerImage: number;
  t2i: string;
  edit: string;
  build: (req: ImageRequest, refs: string[]) => Record<string, unknown>;
}

// Seedream sizes: total area kept at or under 1536×1536 (the cheaper price tier).
const SEEDREAM_SIZE: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 1152, height: 2048 },
  "4:5": { width: 1360, height: 1700 },
  "1:1": { width: 1536, height: 1536 },
  "16:9": { width: 2048, height: 1152 },
};
// FLUX 3 Klein takes pixel sizes (multiples of 16), about 1 MP.
const KLEIN_SIZE: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 768, height: 1360 },
  "4:5": { width: 912, height: 1136 },
  "1:1": { width: 1024, height: 1024 },
  "16:9": { width: 1360, height: 768 },
};
const withRefs = (refs: string[]) => (refs.length ? { image_urls: refs } : {});

export const FAL_IMAGE: FalImage[] = [
  {
    id: "nano-banana-2",
    label: "Nano Banana 2",
    usdPerImage: 0.08,
    t2i: "fal-ai/nano-banana-2",
    edit: "fal-ai/nano-banana-2/edit",
    build: (req, refs) => ({ prompt: req.prompt, aspect_ratio: req.aspect, resolution: "1K", output_format: "png", num_images: 1, ...withRefs(refs) }),
  },
  {
    id: "seedream-5-pro",
    label: "Seedream 5 Pro",
    usdPerImage: 0.0675,
    t2i: "bytedance/seedream/v5/pro/text-to-image",
    edit: "bytedance/seedream/v5/pro/edit",
    build: (req, refs) => ({ prompt: req.prompt, image_size: SEEDREAM_SIZE[req.aspect], output_format: "png", num_images: 1, ...withRefs(refs) }),
  },
  {
    id: "flux-3",
    label: "FLUX 3",
    usdPerImage: 0.048,
    t2i: "blackforestlabs/flux-3/text-to-image",
    edit: "blackforestlabs/flux-3/edit-image",
    build: (req, refs) => ({ prompt: req.prompt, aspect_ratio: req.aspect, resolution: "1k", output_format: "png", ...withRefs(refs) }),
  },
  {
    id: "flux-3-klein",
    label: "FLUX 3 Klein (borradores)",
    usdPerImage: 0.009,
    t2i: "blackforestlabs/flux-3/klein/text-to-image",
    edit: "blackforestlabs/flux-3/klein/edit-image",
    build: (req, refs) => ({ prompt: req.prompt, image_size: KLEIN_SIZE[req.aspect], output_format: "png", num_images: 1, enable_prompt_expansion: false, ...withRefs(refs) }),
  },
];

/** The exact request each image model sends (exported for tests). */
export const falImageRequest = (id: string, req: ImageRequest) => {
  const m = FAL_IMAGE.find((x) => x.id === id);
  if (!m) return null;
  const refs = (req.refs ?? []).map((r) => r.url);
  return { endpoint: refs.length ? m.edit : m.t2i, body: m.build(req, refs) };
};

function falImage(m: FalImage): ImageProvider {
  return {
    id: m.id,
    label: m.label,
    usdPerImage: m.usdPerImage,
    configured: () => Boolean(process.env.FAL_KEY),
    async generate(req) {
      const r = falImageRequest(m.id, req)!;
      const res = await fetch(`${SYNC}/${r.endpoint}`, {
        method: "POST",
        headers: { ...auth(), "content-type": "application/json" },
        body: JSON.stringify(r.body),
      });
      if (!res.ok) return fail(res, m.label);
      const out = await res.json();
      const url: string | undefined = out?.images?.[0]?.url;
      if (!url) throw new Error(`${m.label} no devolvió imagen.`);
      const file = await fetch(url);
      if (!file.ok) throw new Error(`${m.label}: no se pudo descargar la imagen (${file.status}).`);
      return { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.headers.get("content-type") || "image/png" };
    },
  };
}

export const falImageProviders = FAL_IMAGE.map(falImage);
