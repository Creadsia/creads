import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { allowedWrite, canEditRules, canRead, canRemove, failJson } from "@/lib/data-api";
import { sharedRules } from "@/lib/db";
import { canUseVoice } from "@/lib/voices";

type Ctx = { params: Promise<{ table: string; id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const { table, id } = await params;
  if (!canRead(table)) return NextResponse.json({ error: "Tabla desconocida." }, { status: 404 });
  try {
    const row = await s.db.get(table, id);
    return row ? NextResponse.json({ row }) : NextResponse.json({ error: "No encontrado." }, { status: 404 });
  } catch (err) {
    return failJson(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const { table, id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  try {
    if (table === "rules") {
      if (!canEditRules(s.user)) return NextResponse.json({ error: "Las reglas aprendidas las administra Creadsia." }, { status: 403 });
      return NextResponse.json({ row: await sharedRules.update(id, body) });
    }
    const w = allowedWrite(table, body, s.user.workspace);
    if (typeof w === "string") return NextResponse.json({ error: w }, { status: 400 });
    // an avatar may only use a library voice or one of this customer's own clones
    if (typeof w.data.voice_id === "string" && w.data.voice_id && !(await canUseVoice(s.user.workspace, w.data.voice_id))) {
      return NextResponse.json({ error: "Esa voz no está en tu cuenta." }, { status: 400 });
    }
    const row = await s.db.update(w.table, id, w.data);
    return row ? NextResponse.json({ row }) : NextResponse.json({ error: "No encontrado." }, { status: 404 });
  } catch (err) {
    return failJson(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const { table, id } = await params;
  try {
    if (table === "rules") {
      // shared learnings are switched off, never erased
      if (!canEditRules(s.user)) return NextResponse.json({ error: "Las reglas aprendidas las administra Creadsia." }, { status: 403 });
      await sharedRules.update(id, { active: false });
      return NextResponse.json({ ok: true });
    }
    if (!canRemove(table)) return NextResponse.json({ error: "Esto no se puede borrar desde aquí." }, { status: 400 });
    await s.db.remove(table, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failJson(err);
  }
}
