import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { SESSION_ENDED, session } from "@/lib/access";
import { publicError } from "@/lib/public-error";
import { signedUploadFor } from "@/lib/media";

// Prepares a direct browser → storage upload for files too big to pass through our server (up to 50 MB).
const KINDS: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm", "audio/aac": "aac",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};
const MAX = 50 * 1024 * 1024;

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("upload", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const type = String(b?.type ?? "");
  const size = Number(b?.size ?? 0);
  const ext = KINDS[type];
  if (!ext) return NextResponse.json({ error: type.startsWith("video/") ? "Ese formato de video no sirve. Graba con la cámara normal del celular (MP4 o MOV) e intenta de nuevo." : "Formato no soportado. Usa JPG, PNG, WEBP, MP3, M4A, WAV, MP4 o MOV." }, { status: 400 });
  if (!(size > 0) || size > MAX) {
    const mb = Math.round(size / 1024 / 1024);
    return NextResponse.json({ error: type.startsWith("video/") ? `El video pesa ${mb} MB y el máximo es 50 MB. Grábalo en 1080p (no en 4K) y de 30 a 60 segundos, o recórtalo en el celular antes de subirlo.` : `El archivo pesa ${mb} MB y el máximo es 50 MB.` }, { status: 413 });
  }
  const folder = type.startsWith("image/") ? "uploads/images" : type.startsWith("audio/") ? "uploads/audio" : "uploads/video";
  try {
    return NextResponse.json(await signedUploadFor(s.user.workspace, folder, ext));
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo preparar la subida.") }, { status: 502 });
  }
}
