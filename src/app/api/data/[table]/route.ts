import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { canEditRules, failJson } from "@/lib/data-api";
import { isTable, sharedRules } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET lists the rows of a studio table (only the signed-in customer's); POST adds one.
export async function GET(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const { table } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Tabla desconocida." }, { status: 404 });
  const q = new URL(req.url).searchParams;
  const adId = q.get("ad_id");
  const filter = adId ? `ad_id=eq.${encodeURIComponent(adId)}&order=idx.asc` : "order=created_at.desc&limit=500";
  try {
    if (table === "rules") return NextResponse.json({ rows: await sharedRules.list("order=hits.desc&limit=500"), canEdit: canEditRules(s.user) });
    return NextResponse.json({ rows: await s.db.list(table, filter) });
  } catch (err) {
    return failJson(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const { table } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Tabla desconocida." }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  try {
    if (table === "rules") {
      if (!canEditRules(s.user)) return NextResponse.json({ error: "Las reglas aprendidas las administra Creadsia." }, { status: 403 });
      return NextResponse.json({ row: await sharedRules.add(body) });
    }
    return NextResponse.json({ row: await s.db.insert(table, body) });
  } catch (err) {
    return failJson(err);
  }
}
