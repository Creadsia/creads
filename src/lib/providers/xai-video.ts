import { plainError } from "./fal";
import type { AspectRatio, Job, JobStatus, VideoProvider, VideoRequest } from "./types";

// Grok Imagine video bought straight from xAI (same XAI_API_KEY the office agents use), not through fal.
// Docs: docs.x.ai/developers/model-capabilities/video/generation (checked 2026-10-20):
//   POST /v1/videos/generations {model, prompt, image?:{url}, duration 1–15, aspect_ratio, resolution}
//   → {request_id}; GET /v1/videos/{request_id} → {status: pending|done|failed, video:{url}}
// Prices per second at 720p (xAI): 1.5 Lite US$0.03 · Grok Imagine US$0.07 · 1.5 US$0.14. Clips have sound.
// With a starting image the output keeps the image's shape (aspect_ratio is ignored).
const API = "https://api.x.ai/v1";
const PREFIX = "xai:";

export const xaiConfigured = () => Boolean((process.env.XAI_API_KEY ?? "").trim());
const key = () => {
  const k = (process.env.XAI_API_KEY ?? "").trim();
  if (!k) throw new Error("Falta XAI_API_KEY en Vercel.");
  return k;
};

const ASPECTS: AspectRatio[] = ["9:16", "16:9", "1:1"];
const DURATIONS = [3, 4, 5, 6, 8, 10, 12, 15];
const nearest = (n: number) => DURATIONS.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));

/** The exact job xAI receives (exported for tests). */
export function xaiTask(model: string, req: VideoRequest) {
  const first = req.refs?.find((r) => r.role === "first_frame")?.url;
  return {
    model,
    prompt: req.prompt,
    ...(first ? { image: { url: first } } : { aspect_ratio: ASPECTS.includes(req.aspect) ? req.aspect : "9:16" }),
    duration: nearest(req.seconds),
    resolution: "720p",
  };
}

async function xaiError(res: Response, label: string) {
  const body = await res.json().catch(() => null);
  const msg = String(body?.error?.message ?? body?.error ?? body?.message ?? res.statusText);
  return new Error(`${label}: ${msg.slice(0, 300)} (código ${res.status})`);
}

function submitter(model: string, label: string) {
  return async (req: VideoRequest): Promise<string> => {
    const res = await fetch(`${API}/videos/generations`, {
      method: "POST",
      headers: { authorization: `Bearer ${key()}`, "content-type": "application/json" },
      body: JSON.stringify(xaiTask(model, req)),
    });
    if (!res.ok) throw await xaiError(res, label);
    const id = (await res.json())?.request_id;
    if (typeof id !== "string" || !/^[\w-]+$/.test(id)) throw new Error(`${label} no devolvió un trabajo.`);
    return PREFIX + id;
  };
}

async function poll(jobId: string, label: string): Promise<JobStatus> {
  const id = jobId.slice(PREFIX.length);
  if (!/^[\w-]+$/.test(id)) return { state: "failed", error: "Trabajo inválido." };
  const res = await fetch(`${API}/videos/${id}`, { headers: { authorization: `Bearer ${key()}` }, cache: "no-store" });
  if (!res.ok) throw await xaiError(res, label); // a passing hiccup: the next poll tries again
  const t = await res.json();
  if (t.status === "done") {
    const url = t.video?.url;
    return typeof url === "string" ? { state: "done", url } : { state: "failed", error: `${label} no devolvió video.` };
  }
  if (t.status === "failed" || t.status === "expired") return { state: "failed", error: plainError(label, String(t.error?.message ?? t.error ?? "falló")) };
  return { state: "running" };
}

/** A Grok model that only exists here (no fal version). */
function grokDirect(id: string, model: string, label: string, usdPerSecond: number): VideoProvider {
  const submit = submitter(model, label);
  return {
    id,
    label,
    usdPerSecond,
    configured: xaiConfigured,
    durations: DURATIONS,
    aspects: ASPECTS,
    async submit(req) {
      return { provider: id, jobId: await submit(req) };
    },
    status: (job: Job) => poll(job.jobId, label),
  };
}

export const grokLite = grokDirect("grok-video-lite", "grok-imagine-video-1.5-lite", "Grok Video Lite", 0.03);
export const grokBase = grokDirect("grok-video", "grok-imagine-video", "Grok Video", 0.07);

/** Grok 1.5: xAI first, its fal version as the fallback (same id, so nothing else changes). */
export function grokViaXai(fal: VideoProvider): VideoProvider {
  if (fal.id !== "grok-video-1.5") return fal;
  const submit = submitter("grok-imagine-video-1.5", fal.label);
  return {
    ...fal,
    configured: () => xaiConfigured() || fal.configured(),
    async submit(req): Promise<Job> {
      if (!xaiConfigured()) return fal.submit(req);
      try {
        return { provider: fal.id, jobId: await submit(req) };
      } catch (err) {
        console.error(`[xai] ${fal.id}: ${err instanceof Error ? err.message : err} → fal`);
        if (!fal.configured()) throw err;
        return fal.submit(req);
      }
    },
    status: (job: Job) => (job.jobId.startsWith(PREFIX) ? poll(job.jobId, fal.label) : fal.status(job)),
  };
}
