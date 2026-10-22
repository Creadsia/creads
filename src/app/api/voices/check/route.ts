import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { SESSION_ENDED, session } from "@/lib/access";
import { elevenlabs, sayBrand } from "@/lib/providers/elevenlabs";
import { fetchableUrl, ownsMedia } from "@/lib/media";
import { compare } from "@/lib/textmatch";
import { publicError } from "@/lib/public-error";

export const maxDuration = 60;

// Listens to a recorded line and says whether it says exactly the text (before any video is paid for).
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("gen", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const text = typeof b?.text === "string" ? b.text.trim().slice(0, 3000) : "";
  const lang = b?.lang === "en" ? "en" : "es";
  if (!text || !ownsMedia(b?.url, s.user.workspace)) return NextResponse.json({ error: "Falta la grabación." }, { status: 400 });
  try {
    const { words } = await elevenlabs.transcribe!(await fetchableUrl(b.url, s.user.workspace, 600), lang);
    const r = compare(sayBrand(text), words, lang); // the take says «Cre ads»: compare with what was read
    return NextResponse.json({ ok: r.sim >= 0.9 && !r.severe, sim: r.sim, heard: r.heard, issues: r.issues });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo revisar la voz.") }, { status: 502 });
  }
}
