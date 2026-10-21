import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { elevenlabs } from "@/lib/providers/elevenlabs";
import { FEATURE_UNAVAILABLE as UNAVAILABLE_TEXT, publicError } from "@/lib/public-error";
import { ACCENTS, accentVoices } from "@/lib/voices";

export const dynamic = "force-dynamic";

// Real voices by Spanish accent (Chile, Argentina, Colombia, Mexico) for the voice picker.
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  if (!elevenlabs.configured()) return NextResponse.json({ error: UNAVAILABLE_TEXT }, { status: 503 });
  try {
    const voices = await accentVoices();
    return NextResponse.json({
      accents: ACCENTS.map((a) => ({ locale: a.locale, label: a.label, voices: voices.filter((v) => v.accent === a.locale).map(({ ref, name, gender, age, preview, mine }) => ({ ref, name, gender, age, preview, mine: Boolean(mine) })) })),
    });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudieron leer las voces.") }, { status: 502 });
  }
}
