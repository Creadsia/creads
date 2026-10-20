import { createSign } from "node:crypto";
import { inline } from "./gemini";
import type { Job, JobStatus, VideoProvider } from "./types";

// Veo 3.1 on Google Vertex AI: the stable (GA) models that stay on after the Gemini API previews end
// on 2026-10-22. Auth is a Google Cloud service account (JSON key in GOOGLE_VERTEX_CREDENTIALS, raw or
// base64). Docs: cloud.google.com/vertex-ai/generative-ai/docs/model-reference/veo-video-generation
// (checked 2026-10-20). Without a storage bucket Vertex returns the video as base64 in the operation,
// so the "url" we hand back is the operation name and download() fetches the bytes.
const LOCATION = "us-central1";
const PREFIX = "vertex:";
const OPERATION = /^projects\/[\w-]+\/locations\/[\w-]+\/publishers\/google\/models\/(veo-[\w.-]+)\/operations\/[\w-]+$/;

interface Creds { client_email: string; private_key: string; project_id: string }

export const vertexConfigured = () => Boolean(process.env.GOOGLE_VERTEX_CREDENTIALS);

function creds(): Creds {
  const raw = process.env.GOOGLE_VERTEX_CREDENTIALS?.trim();
  if (!raw) throw new Error("Falta GOOGLE_VERTEX_CREDENTIALS en Vercel.");
  const text = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const c = JSON.parse(text) as Creds;
  if (!c.client_email || !c.private_key || !c.project_id) throw new Error("GOOGLE_VERTEX_CREDENTIALS no es una llave de cuenta de servicio válida.");
  return c;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** The signed request Google trades for an access token (exported for tests). */
export function serviceJwt(c: Pick<Creds, "client_email" | "private_key">, now = Math.floor(Date.now() / 1000)) {
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: c.client_email, scope: "https://www.googleapis.com/auth/cloud-platform", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(c.private_key);
  return `${head}.${claims}.${b64url(sig)}`;
}

let cached: { token: string; until: number } | null = null;

async function token() {
  if (cached && cached.until > Date.now()) return cached.token;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: serviceJwt(creds()) }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.access_token) throw new Error(`Google Vertex no aceptó la cuenta de servicio (${res.status}).`);
  cached = { token: body.access_token, until: Date.now() + (Number(body.expires_in ?? 3600) - 300) * 1000 };
  return cached.token;
}

const modelUrl = (model: string) =>
  `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${creds().project_id}/locations/${LOCATION}/publishers/google/models/${model}`;

async function post(url: string, body: unknown, label: string) {
  const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${await token()}`, "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${label}: ${String(data?.error?.message ?? res.statusText).slice(0, 300)} (código ${res.status})`);
  return data;
}

async function fetchOperation(name: string, label: string) {
  const m = OPERATION.exec(name);
  if (!m) throw new Error("Trabajo inválido.");
  return post(`${modelUrl(m[1])}:fetchPredictOperation`, { operationName: name }, label);
}

export function vertexVeo(id: string, model: string, label: string, usdPerSecond: number): VideoProvider {
  return {
    id,
    label,
    usdPerSecond,
    configured: vertexConfigured,
    durations: [4, 6, 8],
    aspects: ["9:16", "16:9"],

    async submit({ prompt, seconds, aspect, resolution, withAudio, refs }) {
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
      const data = await post(`${modelUrl(model)}:predictLongRunning`, {
        instances: [instance],
        parameters: { aspectRatio: aspect, durationSeconds: dur, resolution, generateAudio: withAudio, personGeneration: "allow_adult", sampleCount: 1 },
      }, label);
      if (typeof data?.name !== "string" || !OPERATION.test(data.name)) throw new Error(`${label}: no devolvió un trabajo.`);
      return { provider: id, jobId: PREFIX + data.name };
    },

    async status(job: Job): Promise<JobStatus> {
      const name = job.jobId.slice(PREFIX.length);
      if (!job.jobId.startsWith(PREFIX) || !OPERATION.test(name)) return { state: "failed", error: "Trabajo inválido." };
      const op = await fetchOperation(name, label);
      if (!op?.done) return { state: "running" };
      if (op.error) return { state: "failed", error: String(op.error.message ?? "Error de Veo.").slice(0, 300) };
      const video = op.response?.videos?.[0];
      if (!video?.bytesBase64Encoded && !video?.gcsUri) {
        const why = op.response?.raiMediaFilteredReasons?.[0];
        return { state: "failed", error: why ? `Bloqueado por los filtros de Google: ${String(why).slice(0, 200)}` : "Veo no devolvió video." };
      }
      return { state: "done", url: PREFIX + name };
    },

    /** The finished video lives inside the operation (base64), so we read it again and decode it. */
    async download(url: string) {
      if (!url.startsWith(PREFIX)) throw new Error("Enlace de video inesperado.");
      const op = await fetchOperation(url.slice(PREFIX.length), label);
      const b64 = op?.response?.videos?.[0]?.bytesBase64Encoded;
      if (typeof b64 !== "string") throw new Error("No se pudo descargar el video de Google.");
      const buf = Buffer.from(b64, "base64");
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    },
  };
}

export const isVertexJob = (jobId: string) => jobId.startsWith(PREFIX);
export const isVertexUrl = (url: string) => url.startsWith(PREFIX);
