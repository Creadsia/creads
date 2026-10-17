import { NextResponse } from "next/server";
import { fullSession } from "@/lib/access";
import { listExamples } from "@/lib/inspiracion";
import { copyMedia } from "@/lib/media";
import { tooMany } from "@/lib/rate";
import { publicError } from "@/lib/public-error";

// "Recrear" on an example: copies the video into the customer's own folder (free) and says which
// tool to open with which suggested instruction.
export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const limited = await tooMany("upload", s.user.id);
  if (limited) return limited;
  const b = (await req.json().catch(() => null)) ?? {};
  try {
    const e = (await listExamples()).find((x) => x.id === b.id);
    if (!e) return NextResponse.json({ error: "Ese ejemplo ya no está disponible." }, { status: 404 });
    const video = await copyMedia(e.video, s.user.workspace, "recrear");
    return NextResponse.json({ video, prompt: e.prompt, mode: e.mode });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo preparar el video.") }, { status: 502 });
  }
}
