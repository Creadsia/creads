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

async function fail(res: Response, what: string): Promise<never> {
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((d) => d?.msg).join("; ") : res.statusText;
  throw new Error(`${what}: ${String(msg).slice(0, 300)} (código ${res.status})`);
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
  /** fal's live price list only works for flat per-second prices; tiered models keep our static 720p price. */
  livePrice?: boolean;
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
    label: "Kling 3.0",
    usdPerSecond: 0.14,
    i2v: "fal-ai/kling-video/v3/standard/image-to-video",
    t2v: "fal-ai/kling-video/v3/standard/text-to-video",
    durations: range(3, 15),
    build: kling,
  },
  {
    id: "kling-3.0-pro",
    label: "Kling 3.0 Pro",
    usdPerSecond: 0.14,
    i2v: "fal-ai/kling-video/v3/pro/image-to-video",
    t2v: "fal-ai/kling-video/v3/pro/text-to-video",
    durations: range(3, 15),
    build: kling,
  },
  {
    id: "kling-3.0-turbo",
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
    label: "Seedance 2.0 Fast",
    usdPerSecond: 0.2419,
    i2v: "bytedance/seedance-2.0/fast/image-to-video",
    t2v: "bytedance/seedance-2.0/fast/text-to-video",
    durations: range(4, 15),
    build: seedance,
  },
  {
    id: "seedance-2.0",
    label: "Seedance 2.0",
    usdPerSecond: 0.3024,
    i2v: "bytedance/seedance-2.0/image-to-video",
    t2v: "bytedance/seedance-2.0/text-to-video",
    durations: range(4, 15),
    build: seedance,
  },
  {
    id: "seedance-2.5",
    label: "Seedance 2.5",
    usdPerSecond: 0.462, // $0.0214 per 1k tokens at 720p
    i2v: "bytedance/seedance-2.5/image-to-video",
    t2v: "bytedance/seedance-2.5/text-to-video",
    durations: range(4, 15),
    build: seedance,
  },
  {
    id: "hailuo-2.3",
    label: "Hailuo 2.3",
    usdPerSecond: 0.056, // $0.28 per 6 s, $0.56 per 10 s
    i2v: "fal-ai/minimax/hailuo-2.3/standard/image-to-video",
    durations: [6, 10],
    livePrice: false,
    build: hailuo,
  },
  {
    id: "hailuo-2.3-pro",
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
    return { state: "failed", error: `${what}: ${String(msg).slice(0, 300)}` };
  }
  return { state: "done", out: await res.json() };
}

function falVideo(m: FalVideo): VideoProvider {
  return {
    id: m.id,
    label: `${m.label} (fal.ai)`,
    usdPerSecond: m.usdPerSecond,
    configured: () => Boolean(process.env.FAL_KEY),
    durations: m.durations.filter((d) => [3, 4, 5, 6, 8, 10, 12, 15].includes(d)),
    aspects: m.aspects ?? ["9:16", "4:5", "1:1", "16:9"],
    needsImage: !m.t2v,

    async submit(req) {
      const image = req.refs?.find((r) => r.role === "first_frame")?.url;
      const endpoint = image ? m.i2v : m.t2v;
      if (!endpoint) throw new Error(`${m.label} necesita una imagen de partida.`);
      return { provider: m.id, jobId: await falSubmit(endpoint, m.build(req, image), m.label) };
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
    label: `${m.label} (fal.ai)`,
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
