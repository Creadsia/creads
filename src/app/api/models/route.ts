import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { imageProviders, videoProviders } from "@/lib/providers";
import { pausedModels } from "@/lib/model-pause";
import { gpuConfigured, itkServerlessOn } from "@/lib/providers/gpu";

// The studio's model list: which models are connected and what they cost.
// Available stack (owner, 9 Nov 2026): GPT (images), ElevenLabs (voices) and our own GPU (video). fal.ai removed.
export async function GET(req: Request) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const paused = await pausedModels();
  // When our own GPU is on (serverless or pod), the studio offers ONLY the GPU models for video and GPT/GPU for
  // images (no paid third-party providers): the customer's money is protected and no one can bill a third party.
  const gpuOn = gpuConfigured() || itkServerlessOn();
  const videos = gpuOn ? videoProviders.filter((p) => p.id.endsWith("-gpu")) : videoProviders;
  const images = gpuOn
    ? imageProviders.filter((p) => p.id.endsWith("-gpu") || p.id.startsWith("gpt-image"))
    : imageProviders;
  return NextResponse.json({
    video: videos.map((p) => ({
      id: p.id,
      label: p.label,
      configured: p.configured() && !paused[p.id], // a model the Guardián paused shows as unavailable
      paused: Boolean(paused[p.id]),
      usdPerSecond: p.usdPerSecond,
      live: false,
      aspects: p.aspects ?? ["9:16", "4:5", "1:1", "16:9"],
      seconds: p.durations ?? [4, 5, 6, 8, 10],
      durations: p.durations ?? null, // the exact lengths the model makes (null: any)
      needsImage: Boolean(p.needsImage),
      silent: Boolean(p.silent),
      noFaces: Boolean(p.noFaces),
      talking: Boolean(p.talking),
      actor: Boolean(p.actor),
    })),
    image: images.map((p) => ({ id: p.id, label: p.label, configured: p.configured(), usd: p.usdPerImage })),
    livePricing: {},
  });
}
