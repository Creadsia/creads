import { NextResponse } from "next/server";
import { fullSession } from "@/lib/access";
import { publicError } from "@/lib/public-error";
import { DbError } from "@/lib/db";

// The latest "Crear" tool jobs (any tool), newest first.
export async function GET(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const { db } = s;
  try {
    const rows = await db.list("clips", "or=(kind.like.tool:*,kind.like.gen:*)&order=created_at.desc&limit=60");
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo cargar."), missingTable: err instanceof DbError && err.missingTable }, { status: 502 });
  }
}
