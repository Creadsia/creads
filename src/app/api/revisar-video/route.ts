import { NextResponse } from "next/server";
import { fullSession } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { ownsMedia } from "@/lib/media";
import { analyzeVideo } from "@/lib/influencer/swap";

export const maxDuration = 120;

// POST {video}: the free check before «Mi personaje en un video» (the traffic light under the upload).
// The same result is used when the video starts, so what the customer sees is what happens.

export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const limited = await tooMany("gen", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  if (!ownsMedia(b?.video, s.user.workspace)) return NextResponse.json({ error: "Sube un video." }, { status: 400 });
  try {
    const a = await analyzeVideo(b.video, s.user.workspace);
    return NextResponse.json({ level: a.level, checks: a.checks, start: a.start, usable: a.usable, dur: a.dur });
  } catch (err) {
    console.error("revisar-video", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No pudimos revisar el video. Prueba con un MP4." }, { status: 502 });
  }
}
