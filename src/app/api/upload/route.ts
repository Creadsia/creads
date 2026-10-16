import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { checkAccess } from "@/lib/access";
import { uploadMedia } from "@/lib/supabase";

export const maxDuration = 30;

const KINDS: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/wav": "wav", "audio/ogg": "ogg",
  "video/mp4": "mp4",
};

// Uploads a face photo, product photo or audio sample to our storage and returns its link.
export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  const ext = KINDS[file.type];
  if (!ext) return NextResponse.json({ error: "Formato no soportado. Usa JPG, PNG, WEBP, MP3, M4A, WAV o MP4." }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "El archivo pesa más de 4 MB." }, { status: 413 });
  const folder = file.type.startsWith("image/") ? "uploads/images" : file.type.startsWith("audio/") ? "uploads/audio" : "uploads/video";
  try {
    const url = await uploadMedia(`${folder}/${randomUUID()}.${ext}`, new Uint8Array(await file.arrayBuffer()), file.type);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo subir." }, { status: 502 });
  }
}
