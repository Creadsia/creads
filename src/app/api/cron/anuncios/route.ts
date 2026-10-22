import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sweepOpenAds } from "@/lib/api-ads";
import { once } from "@/lib/marketing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Ads left in production with nobody watching (the customer closed Automático): moved forward here, called
// by the Guardián's 5-minute round in its own request. CRON_SECRET only.
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.byteLength === y.byteLength && timingSafeEqual(x, y); };

export async function POST(req: Request) {
  const cron = (process.env.CRON_SECRET ?? "").trim();
  if (cron.length < 16 || !same(req.headers.get("authorization") ?? "", `Bearer ${cron}`)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!(await once("sweep-anuncios", 240))) return NextResponse.json({ ok: true, skipped: true });
  const r = await sweepOpenAds(270_000);
  return NextResponse.json({ ok: true, ...r });
}
