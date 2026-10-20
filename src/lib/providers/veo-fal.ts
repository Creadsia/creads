import { falPoll, falSubmit } from "./fal";
import type { Job, JobStatus, VideoProvider } from "./types";

// Veo 3.1 through fal.ai: the emergency exit only (see veo.ts). Google comes first; fal takes a clip
// when Google refuses it or isn't connected.
// Endpoints and prices: fal.ai/models/fal-ai/veo3.1 (checked 2026-10-20). Prices are with audio, 720p.

interface Veo { id: string; label: string; usdPerSecond: number; t2v: string; i2v: string; ref?: string }

export const VEO_FAL: Veo[] = [
  { id: "veo-3.1-fast", label: "Veo 3.1 Fast", usdPerSecond: 0.15, t2v: "fal-ai/veo3.1/fast", i2v: "fal-ai/veo3.1/fast/image-to-video" },
  // reference images (face, product) only on the standard model, always 8 s
  { id: "veo-3.1", label: "Veo 3.1", usdPerSecond: 0.4, t2v: "fal-ai/veo3.1", i2v: "fal-ai/veo3.1/image-to-video", ref: "fal-ai/veo3.1/reference-to-video" },
];

/** The exact request each Veo call sends (exported for tests). */
export function veoRequest(m: Veo, req: { prompt: string; seconds: number; aspect: string; withAudio: boolean; refs?: { url: string; role: string }[] }) {
  if (req.aspect !== "9:16" && req.aspect !== "16:9") throw new Error("Veo solo hace videos 9:16 o 16:9.");
  const first = req.refs?.find((r) => r.role === "first_frame")?.url;
  const assets = (req.refs ?? []).filter((r) => r.role === "face" || r.role === "product").map((r) => r.url).slice(0, 3);
  const base = { prompt: req.prompt, aspect_ratio: req.aspect, resolution: "720p", generate_audio: req.withAudio };
  if (assets.length && m.ref) return { endpoint: m.ref, body: { ...base, image_urls: assets, duration: "8s" } };
  const dur = req.seconds <= 4 ? "4s" : req.seconds <= 6 ? "6s" : "8s";
  if (first) return { endpoint: m.i2v, body: { ...base, image_url: first, duration: dur } };
  return { endpoint: m.t2v, body: { ...base, duration: dur } };
}

export function veoFal(m: Veo): VideoProvider {
  return {
    id: m.id,
    label: m.label,
    usdPerSecond: m.usdPerSecond,
    configured: () => Boolean(process.env.FAL_KEY),
    durations: [4, 6, 8],
    aspects: ["9:16", "16:9"],
    async submit(req) {
      const r = veoRequest(m, req);
      return { provider: m.id, jobId: await falSubmit(r.endpoint, r.body, m.label) };
    },
    async status(job: Job): Promise<JobStatus> {
      const r = await falPoll(job.jobId, m.label);
      if (r.state !== "done") return r;
      const url = (r.out.video as { url?: string } | undefined)?.url;
      return url ? { state: "done", url } : { state: "failed", error: `${m.label} no devolvió video.` };
    },
  };
}
