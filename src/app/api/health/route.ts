import { NextResponse } from "next/server";
import { providerStatus } from "@/lib/providers";
import { elevenlabs } from "@/lib/providers/elevenlabs";
import { falPricing } from "@/lib/providers/fal";

export const dynamic = "force-dynamic";

// Quick check of which services have their keys configured (never returns the keys),
// plus two free calls that prove the fal and ElevenLabs keys work (prices, plan usage).
export async function GET() {
  const voice = elevenlabs.configured()
    ? await elevenlabs.usage!().then((u) => ({ ok: true, tier: u.tier }), (e) => ({ ok: false, error: String(e?.message ?? e).slice(0, 160) }))
    : null;
  return NextResponse.json({ ok: true, providers: providerStatus(), falPrices: await falPricing(), elevenlabs: voice });
}
