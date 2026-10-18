import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { advanceProduction } from "@/lib/autoprod";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The automatic producer's round (lib/autoprod.ts): started every 5 minutes by the Guardián's ping and right
// after an ad request is approved. Server-to-server only (CRON_SECRET).
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.byteLength === y.byteLength && timingSafeEqual(x, y); };

export async function POST(req: Request) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (secret.length < 16 || !same(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try { return NextResponse.json({ ok: true, trabajos: await advanceProduction() }); }
  catch (e) { console.error("produccion", e instanceof Error ? e.message : e); return NextResponse.json({ ok: false }, { status: 500 }); }
}
