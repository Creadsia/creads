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
];

const RESULT = /^https:\/\/queue\.fal\.run\/[\w./-]+\/requests\/[\w-]+$/;

function falVideo(m: FalVideo): VideoProvider {
  return {
    id: m.id,
    label: `${m.label} (fal.ai)`,
    usdPerSecond: m.usdPerSecond,
    configured: () => Boolean(process.env.FAL_KEY),

    async submit(req) {
      const image = req.refs?.find((r) => r.role === "first_frame")?.url;
      const endpoint = image ? m.i2v : m.t2v;
      if (!endpoint) throw new Error(`${m.label} necesita una imagen de partida.`);
      const res = await fetch(`${QUEUE}/${endpoint}`, {
        method: "POST",
        headers: { ...auth(), "content-type": "application/json" },
        body: JSON.stringify(m.build(req, image)),
      });
      if (!res.ok) return fail(res, m.label);
      const data = await res.json();
      // The response_url already points at the right app path; we keep it as the job id.
      if (!data?.response_url) throw new Error(`${m.label}: no devolvió un trabajo.`);
      return { provider: m.id, jobId: data.response_url as string };
    },

    async status(job: Job): Promise<JobStatus> {
      if (!RESULT.test(job.jobId)) return { state: "failed", error: "Trabajo inválido." };
      const st = await fetch(`${job.jobId}/status`, { headers: auth() });
      if (!st.ok) return fail(st, m.label);
      const s = await st.json();
      if (s.status === "IN_QUEUE") return { state: "queued" };
      if (s.status !== "COMPLETED") return { state: "running" };

      const res = await fetch(job.jobId, { headers: auth() });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const d = body?.detail;
        const msg = typeof d === "string" ? d : Array.isArray(d) ? d.map((x) => x?.msg).join("; ") : `código ${res.status}`;
        return { state: "failed", error: `${m.label}: ${String(msg).slice(0, 300)}` };
      }
      const out = await res.json();
      const url: string | undefined = out?.video?.url;
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
  const qs = FAL_VIDEO.map((m) => `endpoint_id=${encodeURIComponent(m.i2v)}`).join("&");
  try {
    const res = await fetch(`https://api.fal.ai/v1/models/pricing?${qs}`, { headers: auth(), next: { revalidate: 3600 } });
    if (!res.ok) return {};
    const data = await res.json();
    const out: Record<string, { usd: number; unit: string }> = {};
    for (const p of data?.prices ?? []) {
      const m = FAL_VIDEO.find((x) => x.i2v === p.endpoint_id);
      if (m && typeof p.unit_price === "number") out[m.id] = { usd: p.unit_price, unit: String(p.unit ?? "") };
    }
    return out;
  } catch {
    return {};
  }
}
