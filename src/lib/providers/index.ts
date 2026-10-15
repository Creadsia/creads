import type { ImageProvider, TextAI, VideoProvider, VoiceProvider } from "./types";

// Registry of providers. Each entry is wired to its real API in Phase 1;
// until then `configured()` only reports whether its key is present.
const has = (name: string) => Boolean(process.env[name]);

const notYet = (what: string) => () => {
  throw new Error(`${what}: conexión pendiente (Fase 1).`);
};

export const videoProviders: VideoProvider[] = [
  {
    id: "veo-3.1-fast",
    label: "Veo 3.1 Fast (Gemini API)",
    usdPerSecond: 0.12, // 1080p, Gemini API, checked 2026-10-13
    configured: () => has("GEMINI_API_KEY"),
    submit: notYet("Veo 3.1"),
    status: notYet("Veo 3.1"),
  },
  {
    id: "seedance-2.0",
    label: "Seedance 2.0 (fal.ai)",
    usdPerSecond: 0, // to confirm on fal.ai before pricing
    configured: () => has("FAL_KEY"),
    submit: notYet("Seedance 2.0"),
    status: notYet("Seedance 2.0"),
  },
  {
    id: "kling-3.0",
    label: "Kling 3.0 (fal.ai)",
    usdPerSecond: 0, // to confirm on fal.ai before pricing
    configured: () => has("FAL_KEY"),
    submit: notYet("Kling 3.0"),
    status: notYet("Kling 3.0"),
  },
];

export const imageProviders: ImageProvider[] = [
  {
    id: "nano-banana-pro",
    label: "Nano Banana Pro (Gemini API)",
    usdPerImage: 0.134, // 1K/2K, checked 2026-10-13
    configured: () => has("GEMINI_API_KEY"),
    submit: notYet("Nano Banana Pro"),
    status: notYet("Nano Banana Pro"),
  },
];

export const voiceProviders: VoiceProvider[] = [
  {
    id: "elevenlabs",
    configured: () => has("ELEVENLABS_API_KEY"),
    clone: notYet("ElevenLabs"),
    speak: notYet("ElevenLabs"),
  },
];

export const textAI: TextAI = {
  id: "claude",
  configured: () => has("ANTHROPIC_API_KEY"),
  complete: notYet("Claude API"),
};

/** Which services have keys configured (for /api/health and the admin panel). */
export function providerStatus() {
  return {
    claude: textAI.configured(),
    video: Object.fromEntries(videoProviders.map((p) => [p.id, p.configured()])),
    image: Object.fromEntries(imageProviders.map((p) => [p.id, p.configured()])),
    voice: Object.fromEntries(voiceProviders.map((p) => [p.id, p.configured()])),
    database: has("SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY"),
    foreplay: has("FOREPLAY_API_KEY"),
  };
}
