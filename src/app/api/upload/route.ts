import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { randomUUID } from "node:crypto";
import { SESSION_ENDED, session } from "@/lib/access";
import { saveMedia } from "@/lib/media";

export const maxDuration = 30;

const KINDS: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/wav": "wav", "audio/ogg": "ogg",
  "video/mp4": "mp4",
};

// Uploads a face photo, product photo or audio sample to our storage and returns its link.
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("upload", s.user.id);
  if (limited) return limited;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  const ext = KINDS[file.type];
  if (!ext) return NextResponse.json({ error: "Formato no soportado. Usa JPG, PNG, WEBP, MP3, M4A, WAV o MP4." }, { status: 400 });
  if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "El archivo pesa más de 4 MB." }, { status: 413 });
  const folder = file.type.startsWith("image/") ? "uploads/images" : file.type.startsWith("audio/") ? "uploads/audio" : "uploads/video";
  try {
    const url = await saveMedia(s.user.workspace, folder, new Uint8Array(await file.arrayBuffer()), file.type, `${randomUUID()}.${ext}`);
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo subir." }, { status: 502 });
  }
}
