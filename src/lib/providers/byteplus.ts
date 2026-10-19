import { plainError } from "./fal";
import type { AspectRatio, Job, JobStatus, VideoProvider, VideoRequest } from "./types";

// BytePlus ModelArk: Seedance bought straight from ByteDance (about half of fal.ai's price).
// Docs checked 2026-10-19: https://ai.byteplus.com/ark/region:ap-southeast-1/docs/create-video-generation-task-api
// Every Seedance model keeps its fal version as a fallback: if BytePlus refuses a job (no balance,
// key missing, rate limit, server down) the same job goes to fal, so the customer never notices.
const ARK = "https://ark.ap-southeast.bytepluses.com/api/v3";
const PREFIX = "ark:";

/** Our model id → BytePlus model id. */
export const ARK_MODELS: Record<string, string> = {
  "seedance-2.5": "dreamina-seedance-2-5-260628",
  "seedance-2.0": "dreamina-seedance-2-0-260128",
  "seedance-2.0-fast": "dreamina-seedance-2-0-fast-260128",
};

/**
 * What the customer pays when BytePlus is connected, as a share of the fal price. BytePlus costs about
 * half; the owner chose to pass half of the saving on (19 Oct 2026): 25% cheaper for the customer,
 * 25% more margin for Creads.
 */
export const DIRECT_SHARE = 0.75;

export const arkConfigured = () => Boolean(process.env.BYTEPLUS_API_KEY);

function key() {
  const k = process.env.BYTEPLUS_API_KEY;
  if (!k) throw new Error("Falta BYTEPLUS_API_KEY en Vercel.");
  return k;
}

const nearest = (n: number, list: number[]) => list.reduce((a, b) => (Math.abs(b - n) < Math.abs(a - n) ? b : a));
const SECONDS = Array.from({ length: 12 }, (_, i) => i + 4); // 4–15 s, same as on fal
const ratio = (a: AspectRatio) => (a === "4:5" ? "3:4" : a); // Seedance has no 4:5

/** The exact task BytePlus receives (exported for tests). */
export function arkTask(model: string, req: VideoRequest, image?: string) {
  return {
    model,
    content: [
      { type: "text", text: req.prompt },
      ...(image ? [{ type: "image_url", image_url: { url: image }, role: "first_frame" }] : []),
    ],
    resolution: req.resolution,
    ratio: image ? "adaptive" : ratio(req.aspect),
    duration: nearest(req.seconds, SECONDS),
    generate_audio: req.withAudio,
    watermark: false,
  };
}

async function arkError(res: Response): Promise<Error> {
  const body = await res.json().catch(() => null);
  const code = String(body?.error?.code ?? res.status);
  const msg = String(body?.error?.message ?? res.statusText);
  return new Error(`BytePlus ${code}: ${msg}`.slice(0, 400));
}

/** Seedance on BytePlus, falling back to its fal version. Same id, so nothing else in the app changes. */
export function direct(fal: VideoProvider): VideoProvider {
  const model = ARK_MODELS[fal.id];
  if (!model) return fal;
  return {
    ...fal,
    get usdPerSecond() {
      return arkConfigured() ? +(fal.usdPerSecond * DIRECT_SHARE).toFixed(4) : fal.usdPerSecond;
    },
    configured: () => arkConfigured() || fal.configured(),

    async submit(req): Promise<Job> {
      if (!arkConfigured()) return fal.submit(req);
      const image = req.refs?.find((r) => r.role === "first_frame")?.url;
      try {
        const res = await fetch(`${ARK}/contents/generations/tasks`, {
          method: "POST",
          headers: { authorization: `Bearer ${key()}`, "content-type": "application/json" },
          body: JSON.stringify(arkTask(model, req, image)),
        });
        if (!res.ok) throw await arkError(res);
        const id = (await res.json())?.id;
        if (typeof id !== "string" || !/^[\w-]+$/.test(id)) throw new Error("BytePlus no devolvió un trabajo.");
        return { provider: fal.id, jobId: PREFIX + id };
      } catch (err) {
        console.error(`[byteplus] ${fal.id}: ${err instanceof Error ? err.message : err} → fal`);
        if (!fal.configured()) throw err;
        return fal.submit(req);
      }
    },

    async status(job: Job): Promise<JobStatus> {
      if (!job.jobId.startsWith(PREFIX)) return fal.status(job); // started on fal (fallback or before BytePlus)
      const id = job.jobId.slice(PREFIX.length);
      if (!/^[\w-]+$/.test(id)) return { state: "failed", error: "Trabajo inválido." };
      const res = await fetch(`${ARK}/contents/generations/tasks/${id}`, { headers: { authorization: `Bearer ${key()}` }, cache: "no-store" });
      if (!res.ok) throw await arkError(res); // a passing hiccup: the next poll tries again
      const t = await res.json();
      if (t.status === "queued") return { state: "queued" };
      if (t.status === "running") return { state: "running" };
      if (t.status === "succeeded") {
        const url = t.content?.video_url;
        return typeof url === "string" ? { state: "done", url } : { state: "failed", error: `${fal.label} no devolvió video.` };
      }
      // failed, expired, cancelled: BytePlus doesn't charge for these
      return { state: "failed", error: plainError(fal.label, String(t.error?.message ?? t.status ?? "falló")) };
    },
  };
}
