import { veo as geminiVeo } from "./gemini";
import { isVertexJob, isVertexUrl, vertexVeo } from "./vertex";
import { VEO_FAL, veoFal } from "./veo-fal";
import type { Job, JobStatus, VideoProvider } from "./types";

// Veo 3.1, Google first and fal.ai only as the emergency exit (owner, 20 Oct 2026: fal is expensive).
// Order for each new clip:
//   1. Google Vertex AI (stable models, GOOGLE_VERTEX_CREDENTIALS)
//   2. Gemini API preview (GEMINI_API_KEY), only until Google turns it off on 2026-10-22
//   3. fal.ai (FAL_KEY), and also whenever 1 or 2 refuse the job (no balance, down, quota)
// Same ids as always, so the studio, prices by length and saved choices keep working.
export const GEMINI_PREVIEW_ENDS = Date.parse("2026-10-22T00:00:00Z");
const previewOpen = (now = Date.now()) => now < GEMINI_PREVIEW_ENDS;
const isGeminiJob = (jobId: string) => jobId.startsWith("models/veo");

export function veoChain(id: "veo-3.1-fast" | "veo-3.1", label: string, steps: VideoProvider[]): VideoProvider {
  const [vertex, gemini, fal] = steps;
  const live = () => [vertex, ...(previewOpen() ? [gemini] : []), fal].filter((p) => p.configured());
  return {
    id,
    label,
    get usdPerSecond() {
      return (live()[0] ?? fal).usdPerSecond;
    },
    configured: () => live().length > 0,
    durations: [4, 6, 8],
    aspects: ["9:16", "16:9"],

    async submit(req): Promise<Job> {
      const chain = live();
      if (!chain.length) throw new Error(`${label} no está conectado.`);
      let last: unknown;
      for (const p of chain) {
        try {
          const job = await p.submit(req);
          return { provider: id, jobId: job.jobId };
        } catch (err) {
          last = err;
          console.error(`[veo] ${id} via ${p === vertex ? "vertex" : p === gemini ? "gemini" : "fal"}: ${err instanceof Error ? err.message : err}`);
        }
      }
      throw last;
    },

    status(job: Job): Promise<JobStatus> {
      if (isVertexJob(job.jobId)) return vertex.status(job);
      if (isGeminiJob(job.jobId)) return gemini.status(job);
      return fal.status(job);
    },

    async download(url: string) {
      if (isVertexUrl(url)) return vertex.download!(url);
      if (url.startsWith("https://generativelanguage.googleapis.com/")) return gemini.download!(url);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`No se pudo descargar el video (${res.status}).`);
      return res.arrayBuffer();
    },
  };
}

// Prices per second at 720p with audio. Vertex: cloud.google.com/vertex-ai/generative-ai/pricing
// (Veo 3.1 US$0.40, Fast US$0.15). The Gemini preview
// (2 days left) is priced like Vertex so the price doesn't jump.
const [fastFal, stdFal] = VEO_FAL;
export const veoProviders: VideoProvider[] = [
  veoChain("veo-3.1-fast", "Veo 3.1 Fast", [
    vertexVeo("veo-3.1-fast", "veo-3.1-fast-generate-001", "Veo 3.1 Fast", 0.15),
    geminiVeo("veo-3.1-fast", "veo-3.1-fast-generate-preview", "Veo 3.1 Fast", 0.15),
    veoFal(fastFal),
  ]),
  veoChain("veo-3.1", "Veo 3.1", [
    vertexVeo("veo-3.1", "veo-3.1-generate-001", "Veo 3.1", 0.4),
    geminiVeo("veo-3.1", "veo-3.1-generate-preview", "Veo 3.1", 0.4),
    veoFal(stdFal),
  ]),
];
