import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { imageProviders, videoProviders } from "@/lib/providers";
import { falPricing } from "@/lib/providers/fal";
import { ARK_MODELS, arkConfigured } from "@/lib/providers/byteplus";
import { pausedModels } from "@/lib/model-pause";

// The studio's model list: which models are connected and what they cost (fal prices are live when available).
export async function GET(req: Request) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const [live, paused] = await Promise.all([falPricing(), pausedModels()]);
  return NextResponse.json({
    video: videoProviders.map((p) => {
      // Seedance bought direct (BytePlus) has its own price, not fal's
      const l = arkConfigured() && ARK_MODELS[p.id] ? undefined : live[p.id];
      // Seedance is billed per 1,000 tokens; at 720p, 1 s ≈ 720×1280×24/1024 = 21,600 tokens.
      const perSecond = !l ? null : /sec/i.test(l.unit) ? l.usd : /1000 tokens/i.test(l.unit) ? +(l.usd * 21.6).toFixed(4) : null;
      return {
        id: p.id,
        label: p.label,
        configured: p.configured() && !paused[p.id], // a model the Guardián paused shows as unavailable
        paused: Boolean(paused[p.id]),
        usdPerSecond: perSecond ?? p.usdPerSecond,
        live: perSecond != null,
        aspects: p.aspects ?? ["9:16", "4:5", "1:1", "16:9"],
        seconds: p.durations ?? [4, 5, 6, 8, 10],
        durations: p.durations ?? null, // the exact lengths the model makes (null: any)
        needsImage: Boolean(p.needsImage),
        silent: Boolean(p.silent),
        noFaces: Boolean(p.noFaces),
        talking: Boolean(p.talking),
      };
    }),
    image: imageProviders.map((p) => ({ id: p.id, label: p.label, configured: p.configured(), usd: p.usdPerImage })),
    livePricing: live,
  });
}
