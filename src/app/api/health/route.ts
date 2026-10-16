import { NextResponse } from "next/server";
import { providerStatus } from "@/lib/providers";
import { falPricing } from "@/lib/providers/fal";

export const dynamic = "force-dynamic";

// Quick check of which services have their keys configured (never returns the keys),
// plus fal's public per-model prices to confirm the fal key works.
export async function GET() {
  return NextResponse.json({ ok: true, providers: providerStatus(), falPrices: await falPricing() });
}
