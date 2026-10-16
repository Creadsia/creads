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

  async usage() {
    const res = await fetch(`${API}/v1/user/subscription`, { headers: { "xi-api-key": key() }, cache: "no-store" });
    if (!res.ok) return fail(res, "ElevenLabs");
    const d = await res.json();
    return { used: Number(d.character_count ?? 0), limit: Number(d.character_limit ?? 0), tier: String(d.tier ?? "") };
  },
};
