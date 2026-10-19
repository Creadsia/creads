import { NextResponse } from "next/server";
import { presetById, presetRef } from "@/lib/avatares-creads";
import { fetchableUrl } from "@/lib/media";

export const dynamic = "force-dynamic";

// The picture of a Creads avatar (public: they are invented people shown to every customer).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const p = presetById((await params).id);
  if (!p) return new NextResponse("No encontrado.", { status: 404 });
  try {
    const url = await fetchableUrl(presetRef(p.id), "main", 6 * 3600);
    return NextResponse.redirect(url, { status: 302, headers: { "cache-control": "public, max-age=1800" } });
  } catch {
    return new NextResponse("No encontrado.", { status: 404 });
  }
}
