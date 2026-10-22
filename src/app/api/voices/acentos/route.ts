import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { elevenlabs } from "@/lib/providers/elevenlabs";
import { FEATURE_UNAVAILABLE as UNAVAILABLE_TEXT, publicError } from "@/lib/public-error";
import { ACCENTS, accentVoices, setHidden } from "@/lib/voices";
import { isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Real voices by Spanish accent (Chile, Argentina, Venezuela, Colombia, Mexico) for the voice picker.
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  if (!elevenlabs.configured()) return NextResponse.json({ error: UNAVAILABLE_TEXT }, { status: 503 });
  try {
    const voices = await accentVoices();
    return NextResponse.json({
      curar: isOwner(s.user),
      accents: ACCENTS.map((a) => ({ locale: a.locale, label: a.label, voices: voices.filter((v) => v.accent === a.locale).map(({ ref, name, gender, age, preview, mine, descriptive }) => ({ ref, name, gender, age, preview, mine: Boolean(mine), tono: descriptive || undefined })) })),
    });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudieron leer las voces.") }, { status: 502 });
  }
}

// Owner only: hide a library voice for everybody (it sounded bad), or show it again. {ref, ocultar: boolean}
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  if (!isOwner(s.user)) return NextResponse.json({ error: "Solo el dueño puede ocultar voces." }, { status: 403 });
  const b = await req.json().catch(() => null);
  const id = typeof b?.ref === "string" ? (b.ref.split(":")[2] ?? "") : "";
  try {
    await setHidden(id, b?.ocultar !== false);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo ocultar la voz.") }, { status: 400 });
  }
}
