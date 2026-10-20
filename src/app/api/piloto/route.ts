import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { avanzarPiloto, pausarMalas } from "@/lib/piloto";
import { once } from "@/lib/marketing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The organic autopilot's round (lib/piloto.ts), started every 5 minutes by the Guardián's ping. Twice a
// day it also runs the rule that pauses campaigns spending badly. Server-to-server only (CRON_SECRET).
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.byteLength === y.byteLength && timingSafeEqual(x, y); };

export async function POST(req: Request) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (secret.length < 16 || !same(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const hecho = await avanzarPiloto();
    const pausas = (await once("piloto:pausa", 12 * 3600)) ? await pausarMalas() : [];
    return NextResponse.json({ ok: true, hecho, pausas });
  } catch (e) {
    console.error("piloto", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
