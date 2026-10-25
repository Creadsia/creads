import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/admin";
import { fetchableUrl } from "@/lib/media";
import { cambiarCaso, listarCasos } from "@/lib/casos";
import { type AccionAdmin, aplicarAccion } from "@/lib/caso-fundador";

export const dynamic = "force-dynamic";

// Panel interno → Clientes → Casos fundador (owner and partners).
// GET → every case with its status (the screenshot as a link valid for 1 hour).
// POST {accion:"aprobar"|"publicar"|"despublicar", userId} → status change (only the allowed ones).
// POST {accion:"beneficio", userId, beneficio} → what the customer got in exchange (shown with the testimonial).

const ACCIONES: AccionAdmin[] = ["aprobar", "publicar", "despublicar"];

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const casos = await listarCasos();
    casos.sort((a, b) => Date.parse(b.historial.at(-1)?.fecha ?? "") - Date.parse(a.historial.at(-1)?.fecha ?? ""));
    const out = await Promise.all(casos.map(async (c) => ({
      ...c,
      imagenUrl: c.testimonio?.imagen ? await fetchableUrl(c.testimonio.imagen, c.ws, 3600).catch(() => null) : null,
    })));
    return NextResponse.json({ casos: out });
  } catch (e) {
    console.error("admin casos", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudieron leer los casos." }, { status: 502 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => null);
  const userId = String(b?.userId ?? "");
  if (!userId) return NextResponse.json({ error: "Falta el caso." }, { status: 400 });
  const por = (await currentUser())?.email ?? "panel";
  try {
    if (b?.accion === "beneficio") {
      const beneficio = typeof b.beneficio === "string" ? b.beneficio.trim().slice(0, 200) : "";
      const c = await cambiarCaso(userId, (cur) => (cur ? { ...cur, beneficio: beneficio || undefined } : null));
      return c ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No encontramos ese caso." }, { status: 404 });
    }
    const accion = ACCIONES.find((a) => a === b?.accion);
    if (!accion) return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    let refused = false;
    const c = await cambiarCaso(userId, (cur) => {
      const next = cur ? aplicarAccion(cur, accion, por) : null;
      if (!next) refused = true;
      return next;
    });
    if (!c) return NextResponse.json({ error: "No encontramos ese caso." }, { status: 404 });
    if (refused) return NextResponse.json({ error: accion === "aprobar" ? "Solo se aprueba un testimonio recibido y con permiso." : accion === "publicar" ? "Primero apruébalo (y debe tener permiso)." : "Ese testimonio no está publicado." }, { status: 409 });
    return NextResponse.json({ ok: true, estado: c.estado });
  } catch (e) {
    console.error("admin casos", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 502 });
  }
}
