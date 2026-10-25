import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { cargarMarca, guardarMarca, limpiarMarca } from "@/lib/marca";

export const dynamic = "force-dynamic";

// «Kit de marca»: GET the workspace's kit, PUT to save it (logo, colours, tone, product). Free.
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  return NextResponse.json({ marca: await cargarMarca(s.user.workspace) });
}

export async function PUT(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const b = await req.json().catch(() => null);
  try {
    return NextResponse.json({ marca: await guardarMarca(s.user.workspace, limpiarMarca(b?.marca, s.user.workspace)) });
  } catch {
    return NextResponse.json({ error: "No se pudo guardar tu kit de marca. Intenta de nuevo." }, { status: 502 });
  }
}
