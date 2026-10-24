import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { freeOrLimited } from "@/lib/credits";
import { adSpyConfigured, adTranscript } from "@/lib/providers/adspy";
import { elevenlabs } from "@/lib/providers/elevenlabs";
import { tooMany } from "@/lib/rate";
import { FEATURE_UNAVAILABLE } from "@/lib/public-error";

export const maxDuration = 90;

// POST {id, video?, lang?} → what the person in that ad says, to take it apart in «Crear guion».
// First the ad-library transcript; if that comes back empty, our own transcription of the video file
// (only Meta's video servers are accepted). The ad's text is the page's fallback when nobody speaks.
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const b = await req.json().catch(() => null);
  const id = String(b?.id ?? "").replace(/\D/g, "").slice(0, 30);
  if (!id) return NextResponse.json({ error: "Falta el anuncio." }, { status: 400 });
  const broke = await freeOrLimited(s.user, "script");
  if (broke) return NextResponse.json({ error: broke }, { status: 402 });
  if (!adSpyConfigured()) return NextResponse.json({ error: FEATURE_UNAVAILABLE }, { status: 503 });
  const limited = (await tooMany("spy", s.user.id)) ?? (await tooMany("spyDay", s.user.id));
  if (limited) return limited;
  let transcript = await adTranscript(id).catch(() => "");
  const video = typeof b?.video === "string" && /^https:\/\/[a-z0-9.-]+\.fbcdn\.net\//i.test(b.video) ? b.video : null;
  if (!transcript && video && elevenlabs.configured()) {
    try {
      transcript = (await elevenlabs.transcribe!(video, b?.lang === "en" ? "en" : "es")).text.trim().slice(0, 6000);
    } catch (err) {
      console.error("espiar guion (transcribir)", err instanceof Error ? err.message : err);
    }
  }
  // a few words of background noise aren't a script
  return NextResponse.json({ transcript: transcript.split(/\s+/).filter(Boolean).length >= 6 ? transcript : "" });
}
