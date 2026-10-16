import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { deleteVoice, elevenlabs } from "@/lib/providers/elevenlabs";

export const maxDuration = 60;

// Instant voice clone from an uploaded sample. Requires an explicit consent tick from the uploader.
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const name = String(form?.get("name") ?? "").trim().slice(0, 60);
  const consent = form?.get("consent") === "yes";
  const file = form?.get("file");
  if (!consent) return NextResponse.json({ error: "Falta confirmar el permiso de la persona dueña de la voz." }, { status: 400 });
  if (!name || !(file instanceof File)) return NextResponse.json({ error: "Falta el nombre o el audio." }, { status: 400 });
  if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) return NextResponse.json({ error: "El archivo debe ser audio (mp3, m4a, wav)." }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "El audio pesa más de 4 MB. Usa un mp3 de 1 a 2 minutos." }, { status: 413 });
  try {
    const id = await elevenlabs.clone(name, { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type, filename: file.name || "muestra.mp3" });
    // The clone must be registered to this customer, or nobody may keep it.
    try {
      await s.db.insert("voices", { voice_id: id, name });
    } catch (err) {
      const missing = (err as { missingTable?: boolean }).missingTable;
      // before the accounts are separated (tenancy.sql) only Creadsia exists, so the clone stays with it
      if (!(missing && s.user.workspace === "main")) {
        await deleteVoice(id);
        throw new Error("No se pudo guardar la voz en tu cuenta. Intenta de nuevo.");
      }
    }
    return NextResponse.json({ voiceId: id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo clonar la voz.";
    console.error("voices/clone", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
