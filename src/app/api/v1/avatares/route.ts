import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { SITE } from "@/lib/emails";

export const dynamic = "force-dynamic";

// Public API v1: the account's avatars (the same face in every cut of an ad). Use the id as «avatar» in
// POST /api/v1/anuncios. The picture link opens with the same API key.
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const rows = (await s.db.list("avatars", "order=created_at.desc&limit=100").catch(() => [])) as Record<string, unknown>[];
  return NextResponse.json({
    avatares: rows.map((a) => {
      const img = typeof a.image_url === "string" ? a.image_url : null;
      return { id: a.id, nombre: a.name, descripcion: a.description ?? null, idioma: a.lang ?? null, imagen: img ? (img.startsWith("http") ? img : `${SITE}${img}`) : null };
    }),
  });
}
