import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { allowedWrite, canEditRules, canRead, failJson } from "@/lib/data-api";
import { sharedRules } from "@/lib/db";
import { canUseVoice } from "@/lib/voices";

export const dynamic = "force-dynamic";

// GET lists the rows of a studio table (only the signed-in customer's); POST adds one.
export async function GET(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const { table } = await params;
  try {
    if (table === "rules") return NextResponse.json({ rows: await sharedRules.list("order=hits.desc&limit=500"), canEdit: canEditRules(s.user) });
    if (!canRead(table)) return NextResponse.json({ error: "Tabla desconocida." }, { status: 404 });
    const sp = new URL(req.url).searchParams;
    // just how many (the home screen): no need to send every row
    if (sp.get("count") === "1") return NextResponse.json({ count: await s.db.count(table) });
    const adId = sp.get("ad_id");
    const filter = adId ? `ad_id=eq.${encodeURIComponent(adId)}&order=idx.asc` : "order=created_at.desc&limit=500";
    return NextResponse.json({ rows: await s.db.list(table, filter) });
  } catch (err) {
    return failJson(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const { table } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  try {
    if (table === "rules") {
      if (!canEditRules(s.user)) return NextResponse.json({ error: "Las reglas aprendidas las administra Creadsia." }, { status: 403 });
      return NextResponse.json({ row: await sharedRules.add(body) });
    }
    const w = allowedWrite(table, body, s.user.workspace);
    if (typeof w === "string") return NextResponse.json({ error: w }, { status: 400 });
    // an avatar may only use a library voice or one of this customer's own clones
    if (typeof w.data.voice_id === "string" && w.data.voice_id && !(await canUseVoice(s.user.workspace, w.data.voice_id))) {
      return NextResponse.json({ error: "Esa voz no está en tu cuenta." }, { status: 400 });
    }
    return NextResponse.json({ row: await s.db.insert(w.table, w.data) });
  } catch (err) {
    return failJson(err);
  }
}
