import type { ImageProvider, Job, JobStatus, MediaRef, VideoProvider } from "./types";

// Google Gemini API: Veo 3.1 (video) and Nano Banana Pro (images). Server-only.
// Docs: ai.google.dev/gemini-api/docs/veo and /image-generation (checked 2026-10-15).
const BASE = "https://generativelanguage.googleapis.com/v1beta";

function key() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("Falta GEMINI_API_KEY en Vercel.");
  return k;
}

const headers = () => ({ "x-goog-api-key": key(), "content-type": "application/json" });

/** Turns Google's error body into a short message (never includes the key). */
async function fail(res: Response, what: string): Promise<never> {
  const body = await res.json().catch(() => null);
  const msg: string = body?.error?.message ?? res.statusText;
  throw new Error(`${what}: ${msg.slice(0, 300)} (código ${res.status})`);
}

/** Downloads a reference image (https only, ≤ 10 MB) and returns it as base64 for the API. */
async function inline(ref: MediaRef) {
  if (!/^https:\/\//.test(ref.url)) throw new Error("La imagen de referencia debe ser un enlace https.");
  const res = await fetch(ref.url);
  if (!res.ok) throw new Error(`No se pudo leer la imagen de referencia (${res.status}).`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > 10 * 1024 * 1024) throw new Error("La imagen de referencia pesa más de 10 MB.");
  return { mimeType: res.headers.get("content-type")?.split(";")[0] || "image/png", data: Buffer.from(buf).toString("base64") };
}

// ---------- Nano Banana Pro ----------

export const nanoBananaPro: ImageProvider = {
  id: "nano-banana-pro",
  label: "Nano Banana Pro",
  usdPerImage: 0.134, // 1K/2K
  configured: () => Boolean(process.env.GEMINI_API_KEY),

  async generate({ prompt, aspect, refs }) {
    const parts: object[] = [];
    // References first (face, product), then the instruction.
    for (const r of refs ?? []) {
      const img = await inline(r);
      parts.push({ inlineData: img });
    }
    parts.push({ text: prompt });

    const res = await fetch(`${BASE}/models/gemini-3-pro-image-preview:generateContent`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: aspect, imageSize: "2K" },
        },
      }),
    });
    if (!res.ok) return fail(res, "Nano Banana Pro");

    const data = await res.json();
    const out = (data?.candidates?.[0]?.content?.parts ?? []) as { inlineData?: { mimeType: string; data: string }; text?: string }[];
    const img = out.find((p) => p.inlineData?.data)?.inlineData;
    if (!img) {
      const why = data?.candidates?.[0]?.finishReason || data?.promptFeedback?.blockReason || out.find((p) => p.text)?.text;
      throw new Error(`Nano Banana Pro no devolvió imagen${why ? `: ${String(why).slice(0, 200)}` : "."}`);
    }
    return { bytes: Buffer.from(img.data, "base64"), mime: img.mimeType || "image/png" };
  },
};

// ---------- Veo 3.1 ----------

const OPERATION = /^models\/veo-[\w.-]+\/operations\/[\w-]+$/;

function veo(id: string, model: string, label: string, usdPerSecond: number): VideoProvider {
  return {
    id,
    label,
    usdPerSecond, // 720p
    configured: () => Boolean(process.env.GEMINI_API_KEY),
    durations: [4, 6, 8],
    aspects: ["9:16", "16:9"],

    async submit({ prompt, seconds, aspect, resolution, refs }) {
      if (aspect !== "9:16" && aspect !== "16:9") throw new Error("Veo solo hace videos 9:16 o 16:9.");
      const first = refs?.find((r) => r.role === "first_frame");
      const assets = (refs ?? []).filter((r) => r.role === "face" || r.role === "product").slice(0, 3);

      const instance: Record<string, unknown> = { prompt };
      if (first) {
        const img = await inline(first);
        instance.image = { bytesBase64Encoded: img.data, mimeType: img.mimeType };
      }
      if (assets.length) {
        instance.referenceImages = await Promise.all(
          assets.map(async (r) => {
            const img = await inline(r);
            return { image: { bytesBase64Encoded: img.data, mimeType: img.mimeType }, referenceType: "asset" };
          }),
        );
      }
      // Reference images and 1080p only work with 8-second clips.
      const dur = assets.length || resolution === "1080p" ? 8 : seconds <= 4 ? 4 : seconds <= 6 ? 6 : 8;

      const res = await fetch(`${BASE}/models/${model}:predictLongRunning`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          instances: [instance],
          parameters: {
            aspectRatio: aspect,
            durationSeconds: dur,
            resolution,
            personGeneration: first || assets.length ? "allow_adult" : "allow_all",
          },
        }),
      });
      if (!res.ok) return fail(res, label);
      const data = await res.json();
      if (!data?.name) throw new Error(`${label}: no devolvió un trabajo.`);
      return { provider: id, jobId: data.name as string };
    },

    async status(job: Job): Promise<JobStatus> {
      if (!OPERATION.test(job.jobId)) return { state: "failed", error: "Trabajo inválido." };
      const res = await fetch(`${BASE}/${job.jobId}`, { headers: headers() });
      if (!res.ok) return fail(res, label);
      const op = await res.json();
      if (!op.done) return { state: "running" };
      if (op.error) return { state: "failed", error: String(op.error.message ?? "Error de Veo.").slice(0, 300) };
      const resp = op.response?.generateVideoResponse;
      const uri: string | undefined = resp?.generatedSamples?.[0]?.video?.uri;
      if (!uri) {
        const why = resp?.raiFilteredReasons?.[0];
        return { state: "failed", error: why ? `Bloqueado por los filtros de Google: ${why}` : "Veo no devolvió video." };
      }
      return { state: "done", url: uri };
    },

    /** Google's video links need the API key, so the server downloads and re-hosts them. Kept 2 days by Google. */
    async download(url: string) {
      if (!url.startsWith("https://generativelanguage.googleapis.com/")) throw new Error("Enlace de video inesperado.");
      const res = await fetch(url, { headers: { "x-goog-api-key": key() }, redirect: "follow" });
      if (!res.ok) throw new Error(`No se pudo descargar el video (${res.status}).`);
      return res.arrayBuffer();
    },
  };
}

// Prices per second at 720p, Gemini API (checked 2026-10-15).
export const veoLite = veo("veo-3.1-lite", "veo-3.1-lite-generate-preview", "Veo 3.1 Lite", 0.05);
export const veoFast = veo("veo-3.1-fast", "veo-3.1-fast-generate-preview", "Veo 3.1 Fast", 0.1);
export const veoStd = veo("veo-3.1", "veo-3.1-generate-preview", "Veo 3.1", 0.4);
