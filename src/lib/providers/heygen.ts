import type { AspectRatio, Job, JobStatus, VideoProvider, VideoRequest } from "./types";
import { fetchRetry } from "./retry";

// HeyGen «avatar que habla»: a photo of the presenter + a recorded voice → a talking video (image + audio →
// video, like Kling Avatar). Server-only. Added 2026-10-27 to A/B-test it against the current avatar models
// (owner, Grok study: HeyGen could cut the avatar cost ~70%). Selected explicitly with modelo «heygen-avatar-iv»;
// it changes nothing for the other models.
//
// HeyGen's current API (2026): base api.heygen.com, auth header X-Api-Key, prepaid balance.
//  1. Upload the face and the voice to POST /v3/assets (multipart «file») → each returns data.asset_id + data.url.
//  2. POST /v2/video/generate with a talking_photo character (the face) and a voice of type «audio» (our voice).
//  3. Poll GET /v1/video_status.get?video_id=… for the finished video_url.
// Docs: developers.heygen.com (llms.txt, upload-asset, create-video). Needs HEYGEN_API_KEY.

const API = "https://api.heygen.com";

function key() {
  const k = process.env.HEYGEN_API_KEY?.trim(); // a stray space/newline pasted in Vercel makes every call 401
  if (!k) throw new Error("Falta HEYGEN_API_KEY en Vercel.");
  return k;
}
const auth = () => ({ "x-api-key": key() });

/** HeyGen refusals as something a marketer can act on. `step` says which call failed. */
function plainError(step: string, msg: string) {
  if (/unauthor|invalid.*key|api[\s_-]?key|forbidden|\b401\b|\b403\b/i.test(msg)) return `HeyGen (${step}): la llave no está autorizada. Genera una API key nueva en platform.heygen.com/api-keys (con saldo cargado) y pégala en HEYGEN_API_KEY en Vercel.`;
  if (/face|portrait|no face|detect/i.test(msg)) return `HeyGen no reconoció una cara clara en la foto del avatar. Usa una foto de frente, mirando a la cámara. (${msg.slice(0, 140)})`;
  if (/credit|balance|insufficient|quota|fund/i.test(msg)) return "La cuenta de HeyGen se quedó sin saldo (recarga en platform.heygen.com → Billing → Add funds).";
  return `HeyGen (${step}): ${msg.slice(0, 260)}`;
}

/** Downloads a hosted file (face or voice) and uploads it to HeyGen as a v3 asset. */
async function uploadAsset(url: string, kind: "foto" | "audio"): Promise<{ assetId: string; url: string }> {
  const file = await fetchRetry(url, {}, { maxWaitMs: 20_000 });
  if (!file.ok) throw new Error(`No se pudo leer ${kind === "foto" ? "la foto del avatar" : "el audio de la voz"} (${file.status}).`);
  const mime = file.headers.get("content-type") || (kind === "foto" ? "image/jpeg" : "audio/mpeg");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime }), kind === "foto" ? "face" : "voice");
  const res = await fetch(`${API}/v3/assets`, { method: "POST", headers: auth(), body: form }); // FormData sets its own content-type
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(plainError(`subir ${kind}`, body?.message || body?.error || `código ${res.status}`));
  const assetId = body?.data?.asset_id ?? body?.data?.id;
  const assetUrl = body?.data?.url;
  if (!assetId) throw new Error(`HeyGen no devolvió ${kind} subida (asset_id).`);
  return { assetId: String(assetId), url: assetUrl ? String(assetUrl) : `https://files.heygen.ai/asset/${assetId}` };
}

// 9:16 vertical by default; HeyGen takes exact pixel dimensions.
const DIM: Record<AspectRatio, { width: number; height: number }> = {
  "9:16": { width: 720, height: 1280 },
  "4:5": { width: 864, height: 1080 },
  "1:1": { width: 1080, height: 1080 },
  "16:9": { width: 1280, height: 720 },
};

export const heygenAvatarIV: VideoProvider = {
  id: "heygen-avatar-iv",
  label: "HeyGen Avatar IV · avatar que habla",
  usdPerSecond: 0.0385, // HeyGen Avatar IV «Photo Avatar» = US$0.0385/s (720p y 1080p igual), confirmado en el panel 2026-10-27
  talking: true,
  durations: [3, 4, 5, 6, 8, 10, 12, 15],
  aspects: ["9:16", "4:5", "1:1", "16:9"],
  needsImage: true,
  configured: () => Boolean(process.env.HEYGEN_API_KEY),

  async submit(req: VideoRequest): Promise<Job> {
    const face = req.refs?.find((r) => r.role === "first_frame")?.url;
    const audio = req.refs?.find((r) => r.role === "audio")?.url;
    if (!face) throw new Error("HeyGen necesita la foto del avatar.");
    if (!audio) throw new Error("HeyGen necesita la voz grabada.");
    // Preflight: is the key itself valid? (tells a bad/absent key apart from an endpoint problem.)
    const me = await fetchRetry(`${API}/v3/users/me`, { headers: auth() }, { maxWaitMs: 10_000 });
    if (me.status === 401 || me.status === 403) throw new Error(plainError("llave", `código ${me.status}`));
    const [photo, voice] = await Promise.all([uploadAsset(face, "foto"), uploadAsset(audio, "audio")]);
    const res = await fetchRetry(`${API}/v2/video/generate`, {
      method: "POST",
      headers: { ...auth(), "content-type": "application/json" },
      body: JSON.stringify({
        video_inputs: [{
          character: { type: "talking_photo", talking_photo_id: photo.assetId },
          voice: { type: "audio", audio_url: voice.url }, // our recorded voice (ElevenLabs), not HeyGen TTS
        }],
        dimension: DIM[req.aspect] ?? DIM["9:16"],
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.error) throw new Error(plainError("generar", body?.error?.message || body?.error?.detail || body?.error || body?.message || `código ${res.status}`));
    const videoId = body?.data?.video_id ?? body?.data?.id;
    if (!videoId) throw new Error("HeyGen no devolvió un trabajo (video_id).");
    return { provider: "heygen-avatar-iv", jobId: String(videoId) };
  },

  async status(job: Job): Promise<JobStatus> {
    const res = await fetchRetry(`${API}/v1/video_status.get?video_id=${encodeURIComponent(job.jobId)}`, { headers: auth() }, { maxWaitMs: 15_000 });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { state: "failed", error: plainError("estado", body?.message || `código ${res.status}`) };
    const d = body?.data ?? {};
    const st = String(d.status ?? "");
    if (st === "completed") {
      const url = d.video_url as string | undefined;
      if (!url) return { state: "failed", error: "HeyGen terminó pero no devolvió el video." };
      return { state: "done", url, seconds: typeof d.duration === "number" ? d.duration : undefined };
    }
    if (st === "failed") return { state: "failed", error: plainError("generar", d.error?.message || d.error?.detail || (d.error ? JSON.stringify(d.error) : "falló")) };
    return { state: st === "waiting" || st === "pending" ? "queued" : "running" };
  },
};
