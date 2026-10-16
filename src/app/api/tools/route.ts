import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { db, DbError } from "@/lib/db";

// The latest "Crear" tool jobs (any tool), newest first.
export async function GET(req: Request) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  try {
    const rows = await db.list("clips", "kind=like.tool:*&order=created_at.desc&limit=60");
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo cargar.", missingTable: err instanceof DbError && err.missingTable }, { status: 502 });
  }
}
