import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { elevenlabs, VOICE_MODELS } from "@/lib/providers/elevenlabs";

export const dynamic = "force-dynamic";

// Voices on our ElevenLabs account plus how many characters are left this period.
export async function GET(req: Request) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  if (!elevenlabs.configured()) return NextResponse.json({ error: "Falta ELEVENLABS_API_KEY en Vercel." }, { status: 503 });
  try {
    const [voices, usage] = await Promise.all([elevenlabs.voices(), elevenlabs.usage?.().catch(() => null)]);
    return NextResponse.json({ voices, usage, models: VOICE_MODELS });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudieron leer las voces." }, { status: 502 });
  }
}
