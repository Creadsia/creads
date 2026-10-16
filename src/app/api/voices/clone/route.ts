import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { elevenlabs } from "@/lib/providers/elevenlabs";

export const maxDuration = 60;

// Instant voice clone from an uploaded sample. Requires an explicit consent tick from the uploader.
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
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
    return NextResponse.json({ voiceId: id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo clonar la voz.";
    console.error("voices/clone", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
