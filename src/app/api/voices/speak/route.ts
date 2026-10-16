import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { elevenlabs, VOICE_MODELS } from "@/lib/providers/elevenlabs";
import { saveMedia } from "@/lib/media";
import { canUseVoice } from "@/lib/voices";
import { ensureFunds, explainFailure } from "@/lib/balances";
import { isOwner } from "@/lib/auth";

export const maxDuration = 60;

// Reads a line with a voice and stores the mp3 in our storage.
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 3000) : "";
  const voiceId = typeof body?.voiceId === "string" ? body.voiceId : "";
  const model = VOICE_MODELS.some((m) => m.id === body?.model) ? body.model : "eleven_multilingual_v2";
  // Only the Flash/Turbo models accept a forced language; the others detect it from the text (and reject the field).
  const lang = (body?.lang === "es" || body?.lang === "en") && /flash|turbo/.test(model) ? body.lang : undefined;
  if (text.length < 2 || !voiceId) return NextResponse.json({ error: "Elige una voz y escribe el texto." }, { status: 400 });
  try {
    if (!(await canUseVoice(s.user.workspace, voiceId))) return NextResponse.json({ error: "Esa voz no está en tu cuenta." }, { status: 403 });
    await ensureFunds("eleven", 0, text.length);
    const { bytes, mime } = await elevenlabs.speak(voiceId, text, { model, lang });
    const url = await saveMedia(s.user.workspace, "audio", bytes, mime);
    return NextResponse.json({ url, chars: text.length });
  } catch (err) {
    console.error("voices/speak", err instanceof Error ? err.message : err);
    const msg = await explainFailure(err instanceof Error ? err : new Error("No se pudo generar la voz."), isOwner(s.user), "eleven");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
