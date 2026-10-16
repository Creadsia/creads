import type { AspectRatio, Job, JobStatus, VideoProvider, VideoRequest } from "./types";

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
