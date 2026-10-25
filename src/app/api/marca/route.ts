import { NextResponse } from "next/server";
import { phCapture } from "@/lib/posthog-server";
import { after } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { workspaceRow } from "@/lib/billing";
import { MARCA_VACIA, activarMarca, cargarMarca, guardarMarca, limpiarMarca, listarMarcas, marcaActiva, marcasPermitidas } from "@/lib/marca";

export const dynamic = "force-dynamic";

// «Kit de marca»: GET the brand in use (and the list), PUT to save it, POST {accion:"activar"|"nueva", n}.
// One brand per account; up to 3 with the Agencia plan. Free.

async function limite(ws: string) {
  if (ws === "main") return marcasPermitidas(null, true);
  const w = await workspaceRow(ws).catch(() => null);
  const vigente = Boolean(w?.paid_until && w.paid_until >= new Date().toISOString().slice(0, 10));
  return marcasPermitidas(vigente ? w?.plan : null);
}

async function estado(ws: string) {
  const max = await limite(ws);
  let activa = await marcaActiva(ws);
  if (activa > max) { activa = 1; await activarMarca(ws, 1); }
  return { marca: await cargarMarca(ws, activa), activa, marcas: await listarMarcas(ws, max), max };
}

export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  return NextResponse.json(await estado(s.user.workspace));
}

export async function PUT(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const b = await req.json().catch(() => null);
  try {
    const ws = s.user.workspace;
    const activa = await marcaActiva(ws);
    if (activa > (await limite(ws))) return NextResponse.json({ error: "Tu plan permite una marca. Con Agencia puedes tener hasta 3." }, { status: 403 });
    const antes = await cargarMarca(ws, activa).catch(() => null);
    await guardarMarca(ws, limpiarMarca(b?.marca, ws), activa);
    // the first time a kit gets a brand name: «brand_created» (once per brand slot)
    if (!antes?.nombre?.trim() && limpiarMarca(b?.marca, ws).nombre?.trim()) after(() => phCapture(s.user.id, "brand_created", { marca: activa }, `brand_created-${ws}-${activa}`));
    return NextResponse.json(await estado(ws));
  } catch {
    return NextResponse.json({ error: "No se pudo guardar tu kit de marca. Intenta de nuevo." }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const ws = s.user.workspace;
  const b = await req.json().catch(() => null);
  const max = await limite(ws);
  try {
    if (b?.accion === "activar") {
      const n = Number(b.n);
      if (!(n >= 1 && n <= max)) return NextResponse.json({ error: "Esa marca no está disponible en tu plan." }, { status: 403 });
      await activarMarca(ws, n);
      return NextResponse.json(await estado(ws));
    }
    if (b?.accion === "nueva") {
      const usadas = (await listarMarcas(ws, max)).length;
      if (usadas >= max) return NextResponse.json({ error: max === 1 ? "Con el plan Agencia puedes tener hasta 3 marcas, cada una con su kit." : "Ya tienes 3 marcas, el máximo." }, { status: 403 });
      const n = usadas + 1;
      await guardarMarca(ws, { ...MARCA_VACIA, producto: { ...MARCA_VACIA.producto }, nombre: `Marca ${n}` }, n);
      await activarMarca(ws, n);
      return NextResponse.json(await estado(ws));
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "No se pudo cambiar de marca. Intenta de nuevo." }, { status: 502 });
  }
}
