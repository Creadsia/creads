import type { Voice, VoiceProvider, VoiceSample } from "./types";

// Chatterbox Multilingual V3 (Resemble AI, MIT — commercial OK) running on our GPU as a small TTS REST
// service, to replace the paid ElevenLabs voice (~$0.18/min -> ~$0). Latin-American Spanish + zero-shot voice
// cloning from a ~5s sample; the Chilean accent comes from the cloned reference. Reference server:
// github.com/devnen/Chatterbox-TTS-Server (Docker, REST on :8000).
//
// Config: GPU_ENABLED=1 and GPU_TTS_URL=https://<pod>-8000.proxy.runpod.net . GPU_TTS_TOKEN optional bearer.
//
// NOTE: the exact REST shape (paths, field names) depends on the server build installed on the GPU — confirm
// on staging. The adapter below targets the devnen server's OpenAI-style /v1/audio/speech plus a reference
// upload; adjust the paths if the installed server differs.

export const chatterboxConfigured = () =>
  process.env.GPU_ENABLED === "1" && /^https?:\/\/[^\s]+$/.test((process.env.GPU_TTS_URL ?? "").trim());

const base = () => (process.env.GPU_TTS_URL ?? "").trim().replace(/\/+$/, "");
const auth = (): Record<string, string> => {
  const t = (process.env.GPU_TTS_TOKEN ?? "").trim();
  return t ? { authorization: `Bearer ${t}` } : {};
};

export const chatterboxGpu: VoiceProvider = {
  id: "chatterbox-gpu",
  configured: chatterboxConfigured,

  /** The server's reference/cloned voices. The pipeline mostly uses the customer's cloned voice id directly. */
  async voices(): Promise<Voice[]> {
    try {
      const res = await fetch(`${base()}/api/voices`, { headers: { ...auth() }, cache: "no-store" });
      if (!res.ok) return [];
      const d = (await res.json().catch(() => null)) as { voices?: { id: string; name?: string }[] } | null;
      return (d?.voices ?? []).map((v) => ({ id: v.id, name: v.name ?? v.id, category: "cloned" }));
    } catch {
      return [];
    }
  },

  /** Store a consented sample as a reference voice; returns the id to pass to speak(). */
  async clone(name: string, sample: VoiceSample | VoiceSample[]): Promise<string> {
    const s = Array.isArray(sample) ? sample[0] : sample;
    const form = new FormData();
    form.append("voice_name", name);
    form.append("file", new Blob([s.bytes as unknown as BlobPart], { type: s.mime }), s.filename);
    const res = await fetch(`${base()}/api/voices/upload`, { method: "POST", body: form, headers: { ...auth() } });
    if (!res.ok) throw new Error(`Voz (GPU): no se pudo clonar la voz (${res.status}).`);
    const d = (await res.json().catch(() => null)) as { id?: string; voice_id?: string } | null;
    const id = d?.id ?? d?.voice_id;
    if (!id) throw new Error("Voz (GPU): el servidor no devolvió un id de voz.");
    return id;
  },

  /** Read a line with a cloned/reference voice; returns the audio file (wav). */
  async speak(voiceId: string, text: string, opts?: { lang?: "en" | "es"; speed?: number }): Promise<{ bytes: Uint8Array; mime: string }> {
    const res = await fetch(`${base()}/v1/audio/speech`, {
      method: "POST",
      headers: { "content-type": "application/json", ...auth() },
      body: JSON.stringify({
        model: "chatterbox",
        input: text,
        voice: voiceId,
        language: opts?.lang === "en" ? "en" : "es",
        speed: opts?.speed ?? 1,
        response_format: "wav",
      }),
    });
    if (!res.ok) throw new Error(`Voz (GPU): no se pudo generar el audio (${res.status}).`);
    return { bytes: new Uint8Array(await res.arrayBuffer()), mime: "audio/wav" };
  },
};
