import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { leerRegistros, resumirImagenes } from "@/lib/calidad-imagen";

export const dynamic = "force-dynamic";

// Owner and partners. Plataforma → Calidad → Imágenes: «primer intento OK» per type of piece (goal 90%),
// automatic and manual redos with their reasons. GET ?dias=7|30|90.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const d = Number(new URL(req.url).searchParams.get("dias"));
  const dias = [7, 30, 90].includes(d) ? d : 7;
  return NextResponse.json(resumirImagenes(await leerRegistros(dias), dias));
}
