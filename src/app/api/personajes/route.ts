import { NextResponse, after } from "next/server";
import { faceKitFor } from "@/lib/influencer/swap";
import { fullSession } from "@/lib/access";
import type { Db } from "@/lib/db";
import { creditStatus } from "@/lib/credits";
import { ownsMedia } from "@/lib/media";
import { failJson } from "@/lib/data-api";
import { characterLimit, cleanTraits, describe, type Traits } from "@/lib/influencer/traits";

export const dynamic = "force-dynamic";

// «Mis personajes» (Influencer IA): saved character sheets, reused as the reference image in every video so the
// character comes out the same. Stored as avatars (name, sheet image, the chosen traits in `notes`), so they also
// work wherever an avatar is picked. Limit by plan: Starter 1, Plus 3, Studio unlimited.

const KIND = "personaje";
interface Row { id: string; name: string; image_url: string | null; description: string | null; notes: string | null; created_at: string }
const parse = (r: Row) => {
  let meta: { kind?: string; traits?: Traits } = {};
  try { meta = JSON.parse(r.notes ?? "{}"); } catch { /* an avatar made by hand */ }
  return meta.kind === KIND ? { id: r.id, name: r.name, sheet: r.image_url, description: r.description, traits: meta.traits ?? null, created_at: r.created_at } : null;
};

async function mine(db: Db) {
  const rows = (await db.list("avatars", "order=created_at.desc&limit=200")) as unknown as Row[];
  return rows.map(parse).filter((x): x is NonNullable<ReturnType<typeof parse>> => Boolean(x));
}

export async function GET(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  try {
    const [list, cs] = await Promise.all([mine(s.db), creditStatus(s.user.workspace)]);
    const limit = characterLimit(cs.plan, cs.unlimited);
    return NextResponse.json({ personajes: list, limite: Number.isFinite(limit) ? limit : null });
  } catch (err) { return failJson(err); }
}

/** POST {name, sheet, traits}: saves a character made with «Crear personaje». */
export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const b = await req.json().catch(() => null);
  const name = String(b?.name ?? "").trim().slice(0, 60);
  if (name.length < 2) return NextResponse.json({ error: "Ponle un nombre a tu personaje." }, { status: 400 });
  if (!ownsMedia(b?.sheet, s.user.workspace)) return NextResponse.json({ error: "Elige una ficha creada en tu cuenta." }, { status: 400 });
  try {
    const [list, cs] = await Promise.all([mine(s.db), creditStatus(s.user.workspace)]);
    const limit = characterLimit(cs.plan, cs.unlimited);
    if (list.length >= limit) return NextResponse.json({ error: `Tu plan guarda hasta ${limit} personaje${limit === 1 ? "" : "s"}. Borra uno o sube de plan para guardar más.` }, { status: 403 });
    const traits = b?.traits && typeof b.traits === "object" ? cleanTraits(b.traits as Traits) : null;
    const row = await s.db.insert("avatars", {
      name, image_url: b.sheet, consent: true,
      description: (traits ? describe(traits) : "Personaje creado con Creads").slice(0, 1000),
      notes: JSON.stringify({ kind: KIND, ...(traits ? { traits } : {}) }),
    });
    // its face kit (identity lock for videos), made now so the first video doesn't wait for it
    after(() => faceKitFor(s.db, String(b.sheet), s.user.workspace).catch(() => null));
    return NextResponse.json({ personaje: parse(row as unknown as Row) });
  } catch (err) { return failJson(err); }
}

/** DELETE ?id=… */
export async function DELETE(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  try {
    const list = await mine(s.db);
    if (!list.some((p) => p.id === id)) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });
    await s.db.remove("avatars", id);
    return NextResponse.json({ ok: true });
  } catch (err) { return failJson(err); }
}

