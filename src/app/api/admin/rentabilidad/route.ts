import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { rentabilidadReport } from "@/lib/rentabilidad-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET ?days=30 (owner only): real cost per finished ad by format, cost and failures per provider,
// margin per plan at full use, the three biggest money leaks and cheaper models per step.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const days = Math.min(180, Math.max(1, Math.round(Number(new URL(req.url).searchParams.get("days")) || 30)));
  try {
    return NextResponse.json(await rentabilidadReport(days));
  } catch (err) {
    console.error("rentabilidad", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No se pudieron leer los datos. Prueba de nuevo en un rato." }, { status: 502 });
  }
}
