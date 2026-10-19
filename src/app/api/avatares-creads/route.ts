import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { PRESETS, presetById, presetRef, readyPresets } from "@/lib/avatares-creads";
import { copyMedia } from "@/lib/media";

export const dynamic = "force-dynamic";

// GET: the Creads avatars ready to use. POST {id}: copy one into the customer's account (once) → the avatar row.
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const ready = await readyPresets().catch(() => new Set<string>());
  return NextResponse.json({ avatares: PRESETS.filter((p) => ready.has(p.id)).map((p) => ({ id: p.id, name: p.name, que: p.que, lang: p.lang, img: `/api/avatares-creads/${p.id}` })) });
}

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const b = await req.json().catch(() => null);
  const p = presetById(b?.id);
  if (!p) return NextResponse.json({ error: "Ese avatar no existe." }, { status: 400 });
  try {
    // already in this account: reuse it
    const mine = (await s.db.list("avatars", "order=created_at.desc&limit=200").catch(() => [])) as Record<string, unknown>[];
    const have = mine.find((a) => { try { const n = JSON.parse(String(a.notes ?? "{}")); return n.kind === "creads" && n.preset === p.id; } catch { return false; } });
    if (have) return NextResponse.json({ row: have });
    const image_url = await copyMedia(presetRef(p.id), s.user.workspace, "avatars");
    const row = await s.db.insert("avatars", { name: p.name, description: p.description, image_url, lang: p.lang, consent: true, notes: JSON.stringify({ kind: "creads", preset: p.id }) });
    return NextResponse.json({ row });
  } catch (e) {
    console.error("avatar de Creads", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos agregar ese avatar. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
