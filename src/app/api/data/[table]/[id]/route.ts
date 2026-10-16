import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { isTable, sharedRules } from "@/lib/db";
import { canEditRules, failJson } from "@/lib/data-api";

type Ctx = { params: Promise<{ table: string; id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const { table, id } = await params;
  if (!isTable(table) || table === "rules") return NextResponse.json({ error: "Tabla desconocida." }, { status: 404 });
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
  if (!isTable(table)) return NextResponse.json({ error: "Tabla desconocida." }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  try {
    if (table === "rules") {
      if (!canEditRules(s.user)) return NextResponse.json({ error: "Las reglas aprendidas las administra Creadsia." }, { status: 403 });
      return NextResponse.json({ row: await sharedRules.update(id, body) });
    }
    const row = await s.db.update(table, id, body);
    return row ? NextResponse.json({ row }) : NextResponse.json({ error: "No encontrado." }, { status: 404 });
  } catch (err) {
    return failJson(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const { table, id } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Tabla desconocida." }, { status: 404 });
  try {
    if (table === "rules") {
      // shared learnings are switched off, never erased
      if (!canEditRules(s.user)) return NextResponse.json({ error: "Las reglas aprendidas las administra Creadsia." }, { status: 403 });
      await sharedRules.update(id, { active: false });
      return NextResponse.json({ ok: true });
    }
    await s.db.remove(table, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return failJson(err);
  }
}
