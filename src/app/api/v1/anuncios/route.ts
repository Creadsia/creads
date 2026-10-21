import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { createAd, listAds, publicAd, readOrder } from "@/lib/api-ads";

export const dynamic = "force-dynamic";

// Public API v1. POST {guion, formato?, idioma?, modelo?, titulo?, sello?, avatar?, edicion? ("pro" by default, or "simple")} → a new ad (202, follow it with
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
  const job = await createAd(s.user.workspace, s.user.id, o);
  return NextResponse.json({ anuncio: publicAd(job) }, { status: 202 });
}

export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  return NextResponse.json({ anuncios: (await listAds(s.user.workspace)).map(publicAd) });
}
