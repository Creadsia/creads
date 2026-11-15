import { NextResponse } from "next/server";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { voiceProvider } from "@/lib/providers";
import { uploadMedia } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Generates a voiceover (locución) for the office's agent «Vale»: it POSTs the narration text and gets
// back a public MP3 URL, made with Creads' voice (Chatterbox on GPU, else ElevenLabs). The voice key
// never leaves Creads. Server-to-server only (same secret as the publish bridge).
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.byteLength === y.byteLength && timingSafeEqual(x, y); };

export async function POST(req: Request) {
  const secret = (process.env.CREADS_PUBLISH_SECRET || process.env.CRON_SECRET || "").trim();
  if (secret.length < 16 || !same(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  let body: { texto?: string; voiceId?: string; lang?: "es" | "en"; speed?: number };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }

  const texto = String(body.texto ?? "").trim();
  if (!texto) return NextResponse.json({ error: "Falta el texto a narrar." }, { status: 400 });
  if (texto.length > 5000) return NextResponse.json({ error: "El texto es muy largo (máximo 5000 caracteres)." }, { status: 400 });

  try {
    const vp = voiceProvider();
    if (!vp.configured()) return NextResponse.json({ error: "No hay voz configurada en Creads (ElevenLabs/GPU)." }, { status: 503 });
    let voiceId = String(body.voiceId ?? "").trim();
    if (!voiceId) {
      const vs = await vp.voices();
      voiceId = vs[0]?.id ?? "";
    }
    if (!voiceId) return NextResponse.json({ error: "No hay ninguna voz disponible en la cuenta." }, { status: 503 });

    const { bytes, mime } = await vp.speak(voiceId, texto, { lang: body.lang ?? "es", ...(body.speed ? { speed: body.speed } : {}) });
    const url = await uploadMedia(`externo/voz/${randomUUID()}.mp3`, bytes, mime || "audio/mpeg");
    return NextResponse.json({ ok: true, url, voiceId, mime: mime || "audio/mpeg" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "No se pudo generar la voz." }, { status: 500 });
  }
}
