import type { Voice, VoiceProvider } from "./types";

// ElevenLabs: voice library, instant voice cloning and text-to-speech. Server-only.
// Endpoints checked against api.elevenlabs.io/openapi.json on 2026-10-15.
const API = "https://api.elevenlabs.io";

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("Falta ELEVENLABS_API_KEY en Vercel.");
  return k;
}

async function fail(res: Response, what: string): Promise<never> {
  const body = await res.json().catch(() => null);
  const d = body?.detail;
  const msg = typeof d === "string" ? d : d?.message ?? (Array.isArray(d) ? d.map((x) => x?.msg).join("; ") : res.statusText);
  throw new Error(`${what}: ${String(msg).slice(0, 300)} (código ${res.status})`);
}

/** Models offered in the studio. v3 is the most expressive; Flash is the cheapest and fastest. */
export const VOICE_MODELS = [
  { id: "eleven_v3", label: "Eleven v3 (más expresivo)" },
  { id: "eleven_multilingual_v2", label: "Multilingual v2 (estable)" },
  { id: "eleven_flash_v2_5", label: "Flash v2.5 (rápido y barato)" },
] as const;

export const elevenlabs: VoiceProvider = {
  id: "elevenlabs",
  configured: () => Boolean(process.env.ELEVENLABS_API_KEY),

  async voices() {
    const res = await fetch(`${API}/v2/voices?page_size=100&include_total_count=false`, {
      headers: { "xi-api-key": key() },
      cache: "no-store",
    });
    if (!res.ok) return fail(res, "ElevenLabs");
    const data = await res.json();
    const list: Voice[] = (data?.voices ?? []).map((v: Record<string, unknown>) => ({
      id: String(v.voice_id),
      name: String(v.name ?? "Sin nombre"),
      category: String(v.category ?? ""),
      preview: typeof v.preview_url === "string" ? v.preview_url : undefined,
      labels: (v.labels as Record<string, string>) ?? undefined,
    }));
    // The customer's own (cloned) voices first, then alphabetical.
    return list.sort((a, b) => Number(b.category === "cloned") - Number(a.category === "cloned") || a.name.localeCompare(b.name));
  },

  async clone(name, sample) {
    const form = new FormData();
    form.append("name", name);
    form.append("files", new Blob([sample.bytes as BlobPart], { type: sample.mime }), sample.filename);
    form.append("remove_background_noise", "true");
    form.append("description", "Clonada desde Creads con consentimiento");
    const res = await fetch(`${API}/v1/voices/add`, { method: "POST", headers: { "xi-api-key": key() }, body: form });
    if (!res.ok) return fail(res, "ElevenLabs (clonar)");
    const data = await res.json();
    if (!data?.voice_id) throw new Error("ElevenLabs no devolvió la voz.");
    return String(data.voice_id);
  },

  async speak(voiceId, text, opts) {
    if (!/^[A-Za-z0-9]{10,40}$/.test(voiceId)) throw new Error("Voz inválida.");
    const res = await fetch(`${API}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key(), "content-type": "application/json", accept: "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: opts?.model ?? "eleven_multilingual_v2",
        ...(opts?.lang ? { language_code: opts.lang } : {}),
      }),
    });
    if (!res.ok) return fail(res, "ElevenLabs (voz)");
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime: "audio/mpeg" };
  },

  /** Word-level transcript of a hosted audio or video file (Scribe). Used by the automatic review and the captions. */
  async transcribe(url: string, lang: "en" | "es" = "en") {
    const form = new FormData();
    form.append("model_id", "scribe_v2");
    form.append("source_url", url);
    form.append("timestamps_granularity", "word");
    form.append("tag_audio_events", "false");
    form.append("language_code", lang === "es" ? "spa" : "eng");
    const res = await fetch(`${API}/v1/speech-to-text`, { method: "POST", headers: { "xi-api-key": key() }, body: form });
    if (!res.ok) return fail(res, "ElevenLabs (transcribir)");
    const d = await res.json();
    const words = ((d?.words ?? []) as { text: string; start: number; end: number; type: string }[])
      .filter((w) => w.type === "word" && w.text?.trim())
      .map((w) => ({ w: w.text.trim(), s: Number(w.start), e: Number(w.end) }));
    return { text: String(d?.text ?? ""), words };
  },

  async usage() {
    const res = await fetch(`${API}/v1/user/subscription`, { headers: { "xi-api-key": key() }, cache: "no-store" });
    if (!res.ok) return fail(res, "ElevenLabs");
    const d = await res.json();
    return { used: Number(d.character_count ?? 0), limit: Number(d.character_limit ?? 0), tier: String(d.tier ?? "") };
  },
};

// ---------- dubbing ----------
// Dubbing v1: translates and re-voices a video with the original speakers' voices. No watermark
// (US$0.50/min; the Creator plan includes 12 min a month).

/** Starts a dub of a hosted video/audio into `target` (ISO 639-1). Returns ElevenLabs' dubbing id. */
export async function dubStart(sourceUrl: string, target: string, name: string): Promise<string> {
  const form = new FormData();
  form.append("source_url", sourceUrl);
  form.append("target_lang", target);
  form.append("source_lang", "auto");
  form.append("num_speakers", "0");
  form.append("watermark", "false");
  form.append("name", name.slice(0, 80));
  const res = await fetch(`${API}/v1/dubbing`, { method: "POST", headers: { "xi-api-key": key() }, body: form });
  if (!res.ok) return fail(res, "ElevenLabs (doblaje)");
  const data = await res.json();
  if (!data?.dubbing_id) throw new Error("ElevenLabs (doblaje): no devolvió un trabajo.");
  return String(data.dubbing_id);
}

/** Where a dub is: still working, failed, or finished (then `file` downloads it). */
export async function dubStatus(id: string): Promise<{ state: "running" } | { state: "failed"; error: string } | { state: "done"; mime: string }> {
  if (!/^[A-Za-z0-9]{10,40}$/.test(id)) return { state: "failed", error: "Trabajo inválido." };
  const res = await fetch(`${API}/v1/dubbing/${id}`, { headers: { "xi-api-key": key() }, cache: "no-store" });
  if (!res.ok) return fail(res, "ElevenLabs (doblaje)");
  const d = await res.json();
  if (d?.status === "dubbed") return { state: "done", mime: String(d?.media_metadata?.content_type ?? "video/mp4") };
  if (d?.status === "failed") return { state: "failed", error: `ElevenLabs (doblaje): ${String(d?.error ?? "falló").slice(0, 300)}` };
  return { state: "running" };
}

/** Downloads the finished dub (mp4 for videos, mp3 for audio). */
export async function dubFile(id: string, lang: string): Promise<ArrayBuffer> {
  if (!/^[A-Za-z0-9]{10,40}$/.test(id) || !/^[a-z]{2,3}$/.test(lang)) throw new Error("Trabajo inválido.");
  const res = await fetch(`${API}/v1/dubbing/${id}/audio/${lang}`, { headers: { "xi-api-key": key() } });
  if (!res.ok) return fail(res, "ElevenLabs (doblaje)");
  return res.arrayBuffer();
}

// ---------- music and sound effects ----------
// Music: US$0.15 per minute (the Creator plan includes some minutes). Sound effects: US$0.12 per minute.

/** Composes music from a description. Returns the mp3. */
export async function compose(prompt: string, seconds: number, instrumental: boolean) {
  const res = await fetch(`${API}/v1/music?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key(), "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ prompt, music_length_ms: Math.round(Math.min(300, Math.max(3, seconds)) * 1000), force_instrumental: instrumental }),
  });
  if (!res.ok) return fail(res, "ElevenLabs (música)");
  return new Uint8Array(await res.arrayBuffer());
}

/** Makes a sound effect from a description (0.5–30 s). Returns the mp3. */
export async function soundEffect(text: string, seconds: number) {
  const res = await fetch(`${API}/v1/sound-generation?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key(), "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, duration_seconds: Math.min(30, Math.max(0.5, seconds)), prompt_influence: 0.5 }),
  });
  if (!res.ok) return fail(res, "ElevenLabs (efectos)");
  return new Uint8Array(await res.arrayBuffer());
}
