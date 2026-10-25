import { NextResponse } from "next/server";
import { fetchableUrl } from "@/lib/media";
import { archivoGaleria } from "@/lib/confianza-server";

export const dynamic = "force-dynamic";

// Public files of the home gallery «Hecho con Creads». They live in Creadsia's private workspace, so this
// opens ONLY the files the admin listed in the gallery (nothing else, ever) with a short-lived storage link,
// like /api/vitrina. `?poster=1` opens the still image of a video.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  if (!/^[a-z0-9-]{6,40}$/.test(id)) return new NextResponse("No encontrado.", { status: 404 });
  const ref = await archivoGaleria(id, new URL(req.url).searchParams.has("poster"));
  if (!ref) return new NextResponse("No encontrado.", { status: 404 });
  try {
    const url = await fetchableUrl(ref, "main", 3600);
    return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "public, max-age=1800, s-maxage=1800" } });
  } catch {
    return new NextResponse("No encontrado.", { status: 404 });
  }
}
