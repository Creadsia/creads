import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { needsCredits } from "@/lib/credits";
import { adSpyConfigured, adTranscript } from "@/lib/providers/adspy";
import { tooMany } from "@/lib/rate";
import { FEATURE_UNAVAILABLE } from "@/lib/public-error";

export const maxDuration = 90;

// POST {id} → what the person in that ad says, to take it apart in «Crear guion». The ad's own text
// (sent by the page) is the fallback when the video has no voice.
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const b = await req.json().catch(() => null);
  const id = String(b?.id ?? "").replace(/\D/g, "").slice(0, 30);
  if (!id) return NextResponse.json({ error: "Falta el anuncio." }, { status: 400 });
  const broke = await needsCredits(s.user);
  if (broke) return NextResponse.json({ error: broke }, { status: 402 });
  if (!adSpyConfigured()) return NextResponse.json({ error: FEATURE_UNAVAILABLE }, { status: 503 });
  const limited = (await tooMany("spy", s.user.id)) ?? (await tooMany("spyDay", s.user.id));
  if (limited) return limited;
  try {
    return NextResponse.json({ transcript: await adTranscript(id) });
  } catch (err) {
    console.error("espiar guion", err instanceof Error ? err.message : err);
    return NextResponse.json({ transcript: "" });
  }
}
