import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { ownsMedia } from "@/lib/media";
import { cambiarCaso, casoDe } from "@/lib/casos";
import { PERMISO_TEXTO, recibirTestimonio, retirarPermiso } from "@/lib/caso-fundador";

export const dynamic = "force-dynamic";

// «Caso fundador»: the customer's testimonial form (/app/caso). Only for people who ticked the box at the
// Pack Prueba checkout.
//   GET                                                      → my case (status and what I sent)
//   POST {accion:"enviar", nombre, rubro, texto, imagen?, permiso:true} → sends or edits the testimonial
//   POST {accion:"retirar"}                                  → withdraws the permission (stops showing it)

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").trim().slice(0, max) : "");

export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const c = await casoDe(s.user.id).catch(() => null);
  if (!c) return NextResponse.json({ caso: null, permisoTexto: PERMISO_TEXTO });
  return NextResponse.json({ caso: { estado: c.estado, testimonio: c.testimonio ?? null }, nombre: s.user.name ?? "", permisoTexto: PERMISO_TEXTO });
}

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("heavy", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  try {
    if (!(await casoDe(s.user.id))) return NextResponse.json({ error: "Este formulario es para quienes se sumaron a los casos fundadores al comprar el Pack Prueba." }, { status: 404 });
    if (b?.accion === "retirar") {
      const c = await cambiarCaso(s.user.id, (cur) => (cur ? retirarPermiso(cur) : null));
      return NextResponse.json({ ok: true, caso: c ? { estado: c.estado, testimonio: c.testimonio ?? null } : null });
    }
    if (b?.accion !== "enviar") return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    const nombre = str(b.nombre, 80), rubro = str(b.rubro, 120), texto = str(b.texto, 2000);
    if (nombre.length < 2) return NextResponse.json({ error: "Escribe tu nombre como quieres que aparezca." }, { status: 400 });
    if (texto.length < 20) return NextResponse.json({ error: "Cuéntanos un poco más (al menos una o dos frases)." }, { status: 400 });
    if (b.permiso !== true) return NextResponse.json({ error: "Para enviarlo, marca la casilla de permiso." }, { status: 400 });
    const imagen = b.imagen ? (ownsMedia(b.imagen, s.user.workspace) && /\.(png|jpe?g|webp)$/i.test(String(b.imagen)) ? String(b.imagen) : null) : undefined;
    if (imagen === null) return NextResponse.json({ error: "La imagen no es válida. Súbela de nuevo." }, { status: 400 });
    const c = await cambiarCaso(s.user.id, (cur) => (cur ? recibirTestimonio(cur, { nombre, rubro, texto, imagen, permiso: true }) : null));
    return NextResponse.json({ ok: true, caso: c ? { estado: c.estado, testimonio: c.testimonio ?? null } : null });
  } catch (e) {
    console.error("caso", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
