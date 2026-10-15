import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { imageProviders, videoProviders } from "@/lib/providers";
import { falPricing } from "@/lib/providers/fal";

// The studio's model list: which models are connected and what they cost (fal prices are live when available).
export async function GET(req: Request) {
  const denied = checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const live = await falPricing();
  return NextResponse.json({
    video: videoProviders.map((p) => {
      const l = live[p.id];
      const perSecond = l && /sec/i.test(l.unit) ? l.usd : null;
      return {
        id: p.id,
        label: p.label,
        configured: p.configured(),
        usdPerSecond: perSecond ?? p.usdPerSecond,
        live: perSecond != null,
        // Veo only makes vertical or horizontal clips of 4, 6 or 8 s.
        aspects: p.id.startsWith("veo") ? ["9:16", "16:9"] : ["9:16", "4:5", "1:1", "16:9"],
        seconds: p.id.startsWith("veo") ? [4, 6, 8] : [4, 5, 6, 8, 10],
      };
    }),
    image: imageProviders.map((p) => ({ id: p.id, label: p.label, configured: p.configured(), usd: p.usdPerImage })),
    livePricing: live,
  });
}
