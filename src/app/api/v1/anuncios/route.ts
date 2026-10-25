import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { createAd, listAds, publicAd, readOrder } from "@/lib/api-ads";
import { ownsMedia } from "@/lib/media";

export const dynamic = "force-dynamic";

// Public API v1. POST {guion, formato?, idioma? ("es-CL" | "es" | "en"), modelo?, titulo?, sello?, avatar?, producto? (a product photo link of the account), edicion? ("pro" by default, or "simple"), indicaciones? (notes for the Pro editor)} → a new ad (202, follow it with
// GET /api/v1/anuncios/{id}). GET → the account's latest ads. Auth: `Authorization: Bearer creads_sk_…`.

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("gen", s.user.id);
  if (limited) return limited;
  const o = readOrder((await req.json().catch(() => null)) ?? {});
  if (typeof o === "string") return NextResponse.json({ error: o }, { status: 400 });
  // the avatar must be one of this account's own
  if (o.avatarId && !(await s.db.get("avatars", o.avatarId).catch(() => null))) return NextResponse.json({ error: "Ese avatar no existe en tu cuenta (GET /api/v1/avatares)." }, { status: 400 });
  // the product photo too: a file of this account, nobody else's
  if (o.producto && !ownsMedia(o.producto, s.user.workspace)) return NextResponse.json({ error: "Esa foto del producto no es de tu cuenta. Súbela en Creads o créala con creads_crear_imagen." }, { status: 400 });
  const job = await createAd(s.user.workspace, s.user.id, o);
  return NextResponse.json({ anuncio: publicAd(job) }, { status: 202 });
}

export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  return NextResponse.json({ anuncios: (await listAds(s.user.workspace)).map(publicAd) });
}
