import type { ImageProvider, TextAI, VideoProvider, VoiceProvider } from "./types";
import { claude } from "./claude";
import { elevenlabs } from "./elevenlabs";
import { direct } from "./byteplus";
import { falImageProviders, falVideoProviders } from "./fal";
import { nanoBananaPro, veoFast, veoLite, veoStd } from "./gemini";

// Registry of providers. Gemini (Veo, Nano Banana Pro) is live; the rest are stubs until wired.
// `configured()` reports whether the provider's key is present.
const has = (name: string) => Boolean(process.env[name]);


export const videoProviders: VideoProvider[] = [
  veoLite,
  veoFast,
  veoStd,
  ...falVideoProviders.map(direct), // Seedance: BytePlus first, fal as the fallback
];

export const imageProviders: ImageProvider[] = [nanoBananaPro, ...falImageProviders];

export const voiceProviders: VoiceProvider[] = [elevenlabs];

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
