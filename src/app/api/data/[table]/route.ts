import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { db, DbError, isTable } from "@/lib/db";

export const dynamic = "force-dynamic";

const fail = (err: unknown) =>
  err instanceof DbError
    ? NextResponse.json({ error: err.message, missingTable: err.missingTable }, { status: err.missingTable ? 503 : 502 })
    : NextResponse.json({ error: err instanceof Error ? err.message : "Error inesperado." }, { status: 500 });

// GET lists the rows of a platform table; POST adds one.
export async function GET(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const denied = checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const { table } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Tabla desconocida." }, { status: 404 });
  const q = new URL(req.url).searchParams;
  const filter = q.get("ad_id") ? `ad_id=eq.${encodeURIComponent(q.get("ad_id")!)}&order=idx.asc` : "order=created_at.desc&limit=500";
  try {
    return NextResponse.json({ rows: await db.list(table, filter) });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ table: string }> }) {
  const denied = checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const { table } = await params;
  if (!isTable(table)) return NextResponse.json({ error: "Tabla desconocida." }, { status: 404 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  try {
    return NextResponse.json({ row: await db.insert(table, body) });
  } catch (err) {
    return fail(err);
  }
}
