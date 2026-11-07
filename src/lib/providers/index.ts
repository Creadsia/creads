import type { ImageProvider, TextAI, VideoProvider, VoiceProvider } from "./types";
import { claude } from "./claude";
import { elevenlabs } from "./elevenlabs";
import { direct } from "./byteplus";
import { falImageProviders, falVideoProviders } from "./fal";
import { heygenAvatarIV } from "./heygen";
import { nanoBananaPro, veoFast, veoLite, veoStd } from "./gemini";
import { openaiImageProviders } from "./openai-image";
import { fluxGpu, gpuConfigured, wanBrollGpu } from "./gpu";

// Registry of providers. Gemini (Veo, Nano Banana Pro) is live; the rest are stubs until wired.
// `configured()` reports whether the provider's key is present.
const has = (name: string) => Boolean(process.env[name]);


export const videoProviders: VideoProvider[] = [
  veoLite,
  veoFast,
  veoStd,
  ...falVideoProviders.map(direct), // Seedance: BytePlus first, fal as the fallback
  heygenAvatarIV, // «avatar que habla» vía HeyGen (A/B test; sólo cuando se pide modelo heygen-avatar-iv)
  wanBrollGpu, // B-roll en GPU propia (silencioso; reemplaza a fal.ai cuando GPU_ENABLED=1)
];

export const imageProviders: ImageProvider[] = [fluxGpu, nanoBananaPro, ...falImageProviders, ...openaiImageProviders];

/** The model that draws a scene's opening frame: FLUX on our GPU when it's on (free, no third-party balance),
 *  else Nano Banana 2, else Nano Banana Pro. This is what used to break when Google billing ran dry. */
export function frameImageProvider(): ImageProvider {
  if (gpuConfigured()) return fluxGpu;
  return findImage("nano-banana-2")?.configured() ? findImage("nano-banana-2")! : nanoBananaPro;
}

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
    gpu: gpuConfigured(),
  };
}
