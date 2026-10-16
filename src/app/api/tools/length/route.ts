import { NextResponse } from "next/server";
import { fullSession } from "@/lib/access";
import { probe } from "@/lib/montage";
import { fetchableUrl, ownsMedia } from "@/lib/media";

export const maxDuration = 30;

// Length in seconds of an uploaded video/audio, for when the browser can't read it (e.g. some .mov files).
export async function GET(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const url = new URL(req.url).searchParams.get("url");
  if (!ownsMedia(url, s.user.workspace)) return NextResponse.json({ error: "Archivo inválido." }, { status: 400 });
  try {
    return NextResponse.json({ seconds: (await probe(await fetchableUrl(url, s.user.workspace, 600))).dur });
  } catch {
    return NextResponse.json({ seconds: 0 });
  }
}
