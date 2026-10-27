import type { Job, JobStatus, VideoProvider, VideoRequest } from "./types";
import { fetchRetry } from "./retry";

// HeyGen Avatar IV (av4): a photo of the presenter + a recorded voice → a talking video, in one step
// (image + audio → video, like Kling Avatar). Server-only. Added 2026-10-27 to A/B-test it against the
// current avatar models (owner, Grok study: HeyGen could cut the avatar cost ~70%). Selected explicitly
// with modelo «heygen-avatar-iv»; it changes nothing for the other models.
//
// Flow: upload the face to HeyGen (→ image_key), POST /v2/video/av4/generate with image_key + audio_url,
// then poll /v1/video_status.get until it returns the finished video_url.
// Docs: docs.heygen.com (Create Avatar IV Videos; Using Audio Source as Voice). Needs HEYGEN_API_KEY.

const API = "https://api.heygen.com";
const UPLOAD = "https://upload.heygen.com";

function key() {
  const k = process.env.HEYGEN_API_KEY?.trim(); // a stray space/newline pasted in Vercel makes every call 401
  if (!k) throw new Error("Falta HEYGEN_API_KEY en Vercel.");
  return k;
}
const auth = () => ({ "x-api-key": key() });

/** HeyGen refusals as something a marketer can act on. `step` says which call failed. */
function plainError(step: string, msg: string) {
  if (/unauthor|invalid.*key|api[\s_-]?key|forbidden|401|403/i.test(msg)) return `HeyGen (${step}): la llave no está autorizada. Revisa HEYGEN_API_KEY en Vercel y que la cuenta de HeyGen tenga saldo cargado (API → Add funds).`;
  if (/face|portrait|no face|detect/i.test(msg)) return `HeyGen no reconoció una cara clara en la foto del avatar. Usa una foto de frente, mirando a la cámara. (${msg.slice(0, 140)})`;
  if (/credit|balance|insufficient|quota|fund/i.test(msg)) return "La cuenta de HeyGen se quedó sin saldo (recarga en app.heygen.com → API → Add funds).";
  return `HeyGen (${step}): ${msg.slice(0, 260)}`;
}

/** Downloads the avatar's face and uploads it to HeyGen; returns the image_key av4 needs. */
async function uploadFace(url: string): Promise<string> {
  const file = await fetchRetry(url, {}, { maxWaitMs: 20_000 });
  if (!file.ok) throw new Error(`No se pudo leer la foto del avatar (${file.status}).`);
  const mime = file.headers.get("content-type") || "image/jpeg";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const res = await fetch(`${UPLOAD}/v1/asset`, { method: "POST", headers: { ...auth(), "content-type": mime }, body: bytes });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(plainError("subir la foto", body?.message || body?.error || `código ${res.status}`));
  const imageKey = body?.data?.image_key ?? body?.data?.id ?? body?.image_key;
  if (!imageKey) throw new Error("HeyGen no devolvió la foto subida (image_key).");
  return String(imageKey);
}

export const heygenAvatarIV: VideoProvider = {
  id: "heygen-avatar-iv",
  label: "HeyGen Avatar IV · avatar que habla",
  usdPerSecond: 0.0385, // HeyGen API Avatar IV «Photo Avatar» = US$0.0385/s (720p y 1080p igual), confirmado en el panel 2026-10-27
  talking: true,
  durations: [3, 4, 5, 6, 8, 10, 12, 15],
  aspects: ["9:16", "4:5", "1:1", "16:9"],
  needsImage: true,
  configured: () => Boolean(process.env.HEYGEN_API_KEY),

  async submit(req: VideoRequest): Promise<Job> {
    const face = req.refs?.find((r) => r.role === "first_frame")?.url;
    const audio = req.refs?.find((r) => r.role === "audio")?.url;
    if (!face) throw new Error("HeyGen Avatar IV necesita la foto del avatar.");
    if (!audio) throw new Error("HeyGen Avatar IV necesita la voz grabada.");
    const imageKey = await uploadFace(face);
    const res = await fetchRetry(`${API}/v2/video/av4/generate`, {
      method: "POST",
      headers: { ...auth(), "content-type": "application/json" },
      body: JSON.stringify({
        image_key: imageKey,
        audio_url: audio, // custom voice (ElevenLabs), instead of HeyGen's own TTS
        video_title: "Creads",
      }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || body?.error) throw new Error(plainError("generar", body?.error?.message || body?.error || body?.message || `código ${res.status}`));
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
    if (st === "failed") return { state: "failed", error: plainError("generar", d.error?.message || d.error?.detail || JSON.stringify(d.error ?? "falló")) };
    return { state: st === "waiting" || st === "pending" ? "queued" : "running" };
  },
};
