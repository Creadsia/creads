import { NextResponse } from "next/server";
import { dbFor, sharedRules } from "@/lib/db";
import { providerStatus } from "@/lib/providers";
import { elevenlabs } from "@/lib/providers/elevenlabs";
import { falPricing } from "@/lib/providers/fal";
import { isOwner, userFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Quick check of which services have their keys configured (never returns the keys),
// plus two free calls that prove the fal and ElevenLabs keys work (prices, plan usage).
// Only the owner sees it (it calls outside services); the answer is reused for a minute.
let cached: { at: number; body: unknown } | null = null;

export async function GET(req: Request) {
  if (!isOwner(await userFromRequest(req))) return NextResponse.json({ ok: true });
  if (cached && Date.now() - cached.at < 60_000) return NextResponse.json(cached.body);
  const voice = elevenlabs.configured()
    ? await elevenlabs.usage!().then((u) => ({ ok: true, tier: u.tier }), (e) => ({ ok: false, error: String(e?.message ?? e).slice(0, 160) }))
    : null;
  // Whether the platform tables exist (only true/false, never their contents).
  const names = ["avatars", "products", "scripts", "ads", "clips", "images"] as const;
  const main = dbFor("main");
  const tables: Record<string, boolean> = Object.fromEntries(
    await Promise.all(names.map(async (t) => [t, (await main.count(t).catch(() => null)) !== null] as const)),
  );
  tables.rules = (await sharedRules.list("limit=1").catch(() => null)) !== null;
  // whether the database itself keeps customers apart (DATABASE_URL with the app's own role)
  const isolation = process.env.DATABASE_URL ? "database" : "app";
  const body = { ok: true, providers: providerStatus(), tables, isolation, falPrices: await falPricing(), elevenlabs: voice };
  cached = { at: Date.now(), body };
  return NextResponse.json(body);
}
