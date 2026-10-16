import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { probe } from "@/lib/montage";
import { isOurMedia } from "@/lib/supabase";

export const maxDuration = 30;

// Length in seconds of an uploaded video/audio, for when the browser can't read it (e.g. some .mov files).
export async function GET(req: Request) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const url = new URL(req.url).searchParams.get("url");
  if (!isOurMedia(url)) return NextResponse.json({ error: "Archivo inválido." }, { status: 400 });
  try {
    return NextResponse.json({ seconds: (await probe(url)).dur });
  } catch {
    return NextResponse.json({ seconds: 0 });
  }
}
