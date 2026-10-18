import { NextResponse } from "next/server";
import { DEFAULT_PIXEL, metaConn } from "@/lib/meta-conexiones";

// The pixel ID the website loads (it's public: it appears in every page that uses it). Set in
// Panel → Marketing → Conexiones; cached for a few minutes.
export const dynamic = "force-dynamic";

export async function GET() {
  const id = (await metaConn().catch(() => null))?.pixelId || DEFAULT_PIXEL;
  return NextResponse.json({ id }, { headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
}
