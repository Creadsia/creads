import type { ImageProvider, TextAI, VideoProvider, VoiceProvider } from "./types";
import { claude } from "./claude";
import { falVideoProviders } from "./fal";
import { nanoBananaPro, veoFast, veoLite, veoStd } from "./gemini";

// Registry of providers. Gemini (Veo, Nano Banana Pro) is live; the rest are stubs until wired.
// `configured()` reports whether the provider's key is present.
const has = (name: string) => Boolean(process.env[name]);

const notYet = (what: string) => () => {
  throw new Error(`${what}: conexión pendiente (Fase 1).`);
};

export const videoProviders: VideoProvider[] = [
  veoLite,
  veoFast,
  veoStd,
  ...falVideoProviders,
];

export const imageProviders: ImageProvider[] = [nanoBananaPro];

export const voiceProviders: VoiceProvider[] = [
  {
    id: "elevenlabs",
    configured: () => has("ELEVENLABS_API_KEY"),
    clone: notYet("ElevenLabs"),
    speak: notYet("ElevenLabs"),
  },
];

export const textAI: TextAI = claude;

export const findVideo = (id: string) => videoProviders.find((p) => p.id === id);
export const findImage = (id: string) => imageProviders.find((p) => p.id === id);

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
