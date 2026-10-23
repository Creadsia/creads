import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { panelDesde, setDesde, setPrueba } from "@/lib/panel-desde";

export const dynamic = "force-dynamic";

// Owner only. GET → {desde, pruebas}. POST {desde: "ahora" | null} or {prueba: ws, on: boolean}.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json(await panelDesde());
}
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => null);
  try {
    if (typeof b?.prueba === "string") await setPrueba(b.prueba, b.on !== false);
    else if (b?.desde === "ahora") await setDesde(new Date().toISOString());
    else if (b?.desde === null) await setDesde(null);
    else return NextResponse.json({ error: "Nada que cambiar." }, { status: 400 });
    return NextResponse.json(await panelDesde());
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo." }, { status: 400 });
  }
}
