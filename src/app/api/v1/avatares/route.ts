import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { SITE } from "@/lib/emails";
import { bibleText, type Traits } from "@/lib/influencer/traits";

export const dynamic = "force-dynamic";

// Public API v1: the account's avatars (the same face in every cut of an ad). Use the id as «avatar» in
// POST /api/v1/anuncios. The picture link opens with the same API key. «tipo»: personaje (Influencer IA, with its
// «biblia») or avatar.
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const rows = (await s.db.list("avatars", "order=created_at.desc&limit=100").catch(() => [])) as Record<string, unknown>[];
  return NextResponse.json({
    avatares: rows.map((a) => {
      const img = typeof a.image_url === "string" ? a.image_url : null;
      // characters made in Influencer IA carry their bible (personality, tone, catchphrases, kinds of reels)
      let meta: { kind?: string; traits?: Traits } = {};
      try { meta = JSON.parse(String(a.notes ?? "{}")); } catch { /* an avatar made by hand */ }
      const personaje = meta.kind === "personaje";
      return {
        id: a.id, nombre: a.name, descripcion: a.description ?? null, idioma: a.lang ?? null, imagen: img ? (img.startsWith("http") ? img : `${SITE}${img}`) : null,
        tipo: personaje ? "personaje" : "avatar", biblia: personaje ? bibleText(meta.traits?.bible) || null : null,
      };
    }),
  });
}
