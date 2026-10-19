import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { apiKeyFromRequest, createApiKey, listApiKeys, revokeApiKey } from "@/lib/auth";
import { tooMany } from "@/lib/rate";

export const dynamic = "force-dynamic";

// «API» page: the account's keys. Keys are made and removed only from a signed-in browser (never with
// another key, so a leaked key can't make more). The full key is returned once, when it's made.

async function browser(req: Request) {
  if (apiKeyFromRequest(req)) return NextResponse.json({ error: "Las claves se manejan desde Creads, no con otra clave." }, { status: 403 });
  const s = await session(req);
  return s ?? NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
}

export async function GET(req: Request) {
  const s = await browser(req);
  if (s instanceof NextResponse) return s;
  return NextResponse.json({ claves: await listApiKeys(s.user.id) });
}

export async function POST(req: Request) {
  const s = await browser(req);
  if (s instanceof NextResponse) return s;
  const limited = await tooMany("apiKeys", s.user.id);
  if (limited) return limited;
  if ((await listApiKeys(s.user.id)).length >= 10) return NextResponse.json({ error: "Tienes 10 claves. Borra una para crear otra." }, { status: 400 });
  const b = await req.json().catch(() => null);
  const name = String(b?.nombre ?? "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Ponle un nombre a la clave (por ejemplo «Halcón»)." }, { status: 400 });
  const { key, info } = await createApiKey(s.user.id, name);
  return NextResponse.json({ clave: key, info });
}

export async function DELETE(req: Request) {
  const s = await browser(req);
  if (s instanceof NextResponse) return s;
  const ok = await revokeApiKey(s.user.id, new URL(req.url).searchParams.get("id") ?? "");
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No encontré esa clave." }, { status: 404 });
}
