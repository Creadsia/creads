import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { db, DbError, isTable } from "@/lib/db";

const fail = (err: unknown) =>
  err instanceof DbError
    ? NextResponse.json({ error: err.message, missingTable: err.missingTable }, { status: err.missingTable ? 503 : 502 })
    : NextResponse.json({ error: err instanceof Error ? err.message : "Error inesperado." }, { status: 500 });

type Ctx = { params: Promise<{ table: string; id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const { table, id } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Tabla desconocida." }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  try {
    return NextResponse.json({ row: await db.update(table, id, body) });
  } catch (err) {
    return fail(err);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const { table, id } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Tabla desconocida." }, { status: 404 });
  try {
    await db.remove(table, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return fail(err);
  }
}
