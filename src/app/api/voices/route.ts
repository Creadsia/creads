import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { elevenlabs, VOICE_MODELS } from "@/lib/providers/elevenlabs";
import { FEATURE_UNAVAILABLE as UNAVAILABLE_TEXT, publicError } from "@/lib/public-error";
import { voicesFor } from "@/lib/voices";

export const dynamic = "force-dynamic";

// Voices on our ElevenLabs account plus how many characters are left this period.
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  if (!elevenlabs.configured()) return NextResponse.json({ error: UNAVAILABLE_TEXT }, { status: 503 });
  try {
    // library voices + this customer's own clones; the plan's usage only for Creadsia's owner account
    const [voices, usage] = await Promise.all([voicesFor(s.user.workspace), s.user.workspace === "main" ? elevenlabs.usage?.().catch(() => null) : null]);
    return NextResponse.json({ voices, usage, models: VOICE_MODELS });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudieron leer las voces.") }, { status: 502 });
  }
}
