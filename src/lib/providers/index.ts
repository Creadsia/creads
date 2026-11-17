import type { ImageProvider, TextAI, VideoProvider, VoiceProvider } from "./types";
import { claude } from "./claude";
import { elevenlabs } from "./elevenlabs";
import { heygenAvatarIV } from "./heygen";
import { veoFast, veoLite, veoStd } from "./gemini";
import { openaiImageProviders } from "./openai-image";
import { gpuConfigured, infiniteTalkGpu, itkServerlessOn, qwenImageGpu, wanBrollGpu } from "./gpu";
import { chatterboxGpu } from "./chatterbox";
import { falVideoProviders } from "./fal";
import { arkConfigured, direct } from "./byteplus";

// Seedance (ByteDance) as a paid quality option alongside our GPU: bought on BytePlus (about half of
// fal.ai's price) with fal as automatic fallback. Only these three ids; Kling/Hailuo/etc. stay off.
export const seedanceProviders: VideoProvider[] = falVideoProviders
  .filter((p) => p.id.startsWith("seedance-"))
  .map(direct);

// Registry of providers. Gemini (Veo, Nano Banana Pro) is live; the rest are stubs until wired.
// `configured()` reports whether the provider's key is present.
const has = (name: string) => Boolean(process.env[name]);


export const videoProviders: VideoProvider[] = [
  veoLite,
  veoFast,
  veoStd,
  heygenAvatarIV, // «avatar que habla» vía HeyGen (A/B test; sólo cuando se pide modelo heygen-avatar-iv)
  infiniteTalkGpu, // «avatar que habla» con movimiento natural, en GPU propia (reemplaza Kling/MiniMax cuando GPU_ENABLED=1)
  wanBrollGpu, // B-roll en GPU propia (silencioso; reemplaza a fal.ai cuando GPU_ENABLED=1)
  ...seedanceProviders, // Seedance (BytePlus/fal): opción de calidad pagada, convive con la GPU
];

export const imageProviders: ImageProvider[] = [qwenImageGpu, ...openaiImageProviders];

export const voiceProviders: VoiceProvider[] = [chatterboxGpu, elevenlabs];

/** The model that draws a scene's opening frame: OpenAI GPT Image 2.5, fixed (owner, 17 Nov 2026: Nano Banana
 *  removed — Google billing was down and GPT is the agreed image model). Qwen-Image on our own GPU can take
 *  over here (free, no third-party balance) once it's installed on the pod. */
export function frameImageProvider(): ImageProvider {
  const openai = findImage("gpt-image-2.5");
  if (openai?.configured()) return openai;
  if (gpuConfigured()) return qwenImageGpu;
  return openai ?? qwenImageGpu; // GPT (it surfaces a clear «falta la clave» error if missing); never Nano Banana
}

/** The talking-head model: InfiniteTalk on our GPU when it's on — the RunPod serverless endpoint (scales to
 *  many parallel workers) when configured, else the single always-on pod — otherwise the paid default chosen
 *  by pickModel (HeyGen/MiniMax). */
export function talkingProvider(): VideoProvider | undefined {
  return infiniteTalkGpu.configured() ? infiniteTalkGpu : undefined;
}

/** The voice: Chatterbox on our GPU when it's on (free, cloned Chilean voice), else ElevenLabs. */
export function voiceProvider(): VoiceProvider {
  return chatterboxGpu.configured() ? chatterboxGpu : elevenlabs;
}

export const textAI: TextAI = claude;

export const findVideo = (id: string) => videoProviders.find((p) => p.id === id);
export const findImage = (id: string) => imageProviders.find((p) => p.id === id);

/** Customer-facing name of a model for charges and messages: our own-GPU models (InfiniteTalk, Qwen, Wan)
 *  show as «Creads IA» so the internal name never reaches the customer; public models keep their name
 *  (owner, 17 Nov 2026: the customer sees «Creads IA», not «InfiniteTalk (GPU propia)»). */
export const etiquetaCliente = (p: { id: string; label: string }) => (p.id.endsWith("-gpu") ? "Creads IA" : p.label);

/** Which services have keys configured (for /api/health and the admin panel). */
export function providerStatus() {
  return {
    claude: textAI.configured(),
    video: Object.fromEntries(videoProviders.map((p) => [p.id, p.configured()])),
    image: Object.fromEntries(imageProviders.map((p) => [p.id, p.configured()])),
    voice: Object.fromEntries(voiceProviders.map((p) => [p.id, p.configured()])),
    database: has("SUPABASE_URL") && has("SUPABASE_SERVICE_ROLE_KEY"),
    byteplus: arkConfigured(), // Seedance runs on BytePlus when its key is set (else on fal)
    foreplay: has("FOREPLAY_API_KEY"),
    gpu: gpuConfigured(),
    gpuServerless: itkServerlessOn(),
  };
}
