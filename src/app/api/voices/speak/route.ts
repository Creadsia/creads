import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { checkAccess } from "@/lib/access";
import { elevenlabs, VOICE_MODELS } from "@/lib/providers/elevenlabs";
import { uploadMedia } from "@/lib/supabase";

export const maxDuration = 60;

// Reads a line with a voice and stores the mp3 in our storage.
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const body = await req.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 3000) : "";
  const voiceId = typeof body?.voiceId === "string" ? body.voiceId : "";
  const model = VOICE_MODELS.some((m) => m.id === body?.model) ? body.model : "eleven_multilingual_v2";
  const lang = body?.lang === "es" || body?.lang === "en" ? body.lang : undefined;
  if (text.length < 2 || !voiceId) return NextResponse.json({ error: "Elige una voz y escribe el texto." }, { status: 400 });
  try {
    const { bytes, mime } = await elevenlabs.speak(voiceId, text, { model, lang });
    const url = await uploadMedia(`audio/${randomUUID()}.mp3`, bytes, mime);
    return NextResponse.json({ url, chars: text.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo generar la voz.";
    console.error("voices/speak", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
