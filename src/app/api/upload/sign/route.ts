import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { checkAccess } from "@/lib/access";
import { signedUpload } from "@/lib/supabase";

// Prepares a direct browser → storage upload for files too big to pass through our server (up to 50 MB).
const KINDS: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};
const MAX = 50 * 1024 * 1024;

export async function POST(req: Request) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => null);
  const type = String(b?.type ?? "");
  const size = Number(b?.size ?? 0);
  const ext = KINDS[type];
  if (!ext) return NextResponse.json({ error: "Formato no soportado. Usa JPG, PNG, WEBP, MP3, M4A, WAV, MP4 o MOV." }, { status: 400 });
  if (!(size > 0) || size > MAX) return NextResponse.json({ error: "El archivo pesa más de 50 MB." }, { status: 413 });
  const folder = type.startsWith("image/") ? "uploads/images" : type.startsWith("audio/") ? "uploads/audio" : "uploads/video";
  try {
    return NextResponse.json(await signedUpload(`${folder}/${randomUUID()}.${ext}`));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo preparar la subida." }, { status: 502 });
  }
}
