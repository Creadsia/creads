import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { isAdmin } from "@/lib/admin";
import { signedUploadFor } from "@/lib/media";
import { publicError } from "@/lib/public-error";
import { TAG_CONTADORES, TAG_PORTADA, cambiarPortada, contarCrudo, leerPortada } from "@/lib/confianza-server";
import {
  type EntradaRoadmap,
  type Lista,
  type Novedad,
  contadoresVisibles,
  itemPublico,
  limpiarEntrada,
  limpiarItemGaleria,
  metodosPago,
  mover,
  promesaSoporte,
  umbralesContadores,
} from "@/lib/confianza";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Panel → Marketing → Portada (owner only): the home page «confianza» blocks. Gallery files go straight from
// the browser into Creadsia's private folder (ws/main/portada) and are opened to the public only through
// /api/galeria/<id>. Changelog and roadmap entries for /novedades and /roadmap.

const KINDS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm" };
const MAX = 50 * 1024 * 1024;
const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

function refrescar() {
  revalidateTag(TAG_PORTADA);
  for (const p of ["/", "/novedades", "/roadmap", "/sitemap.xml"]) revalidatePath(p);
}

async function estado() {
  const p = await leerPortada();
  const crudo = await contarCrudo().catch(() => null);
  return {
    galeria: p.galeria.map((i) => ({ ...itemPublico(i), creado: i.creado })),
    novedades: p.novedades, roadmap: p.roadmap,
    contadores: { crudo, umbrales: umbralesContadores(process.env), visibles: contadoresVisibles(crudo, process.env) },
    pagos: metodosPago(process.env),
    soporte: promesaSoporte(process.env),
  };
}

export async function GET() {
  if (!(await isAdmin())) return bad("No autorizado.", 401);
  try {
    return NextResponse.json(await estado());
  } catch (err) {
    return bad(publicError(err, "No se pudo leer la portada."), 502);
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return bad("No autorizado.", 401);
  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!b) return bad("Pedido inválido.");
  const accion = String(b.accion ?? "");
  try {
    if (accion === "subir") {
      const type = String(b.type ?? "");
      const size = Number(b.size ?? 0);
      const ext = KINDS[type];
      if (!ext) return bad("Usa JPG, PNG o WEBP (imagen) o MP4, MOV o WEBM (video).");
      if (!(size > 0) || size > MAX) return bad(`El archivo pesa ${Math.round(size / 1024 / 1024)} MB y el máximo es 50 MB.`, 413);
      return NextResponse.json(await signedUploadFor("main", "portada", ext));
    }

    if (accion === "galeria-agregar" || accion === "galeria-editar") {
      let error = "";
      await cambiarPortada((p) => {
        const prev = accion === "galeria-editar" ? p.galeria.find((i) => i.id === b.id) : undefined;
        if (accion === "galeria-editar" && !prev) { error = "Ese elemento ya no está en la galería."; return p; }
        const r = limpiarItemGaleria(prev ? { ...prev, ...b, ref: prev.ref, poster: b.poster === undefined ? prev.poster : b.poster, creado: prev.creado } : b, prev?.id ?? randomUUID());
        if ("error" in r) { error = r.error; return p; }
        return { ...p, galeria: prev ? p.galeria.map((i) => (i.id === prev.id ? r.item : i)) : [r.item, ...p.galeria] };
      });
      if (error) return bad(error);
    } else if (accion === "galeria-borrar") {
      await cambiarPortada((p) => ({ ...p, galeria: p.galeria.filter((i) => i.id !== b.id) }));
    } else if (accion === "galeria-mover") {
      await cambiarPortada((p) => ({ ...p, galeria: mover(p.galeria, String(b.id), b.dir === -1 ? -1 : 1) }));
    } else if (accion === "entrada-guardar" || accion === "entrada-borrar") {
      const lista: Lista | null = b.lista === "novedades" || b.lista === "roadmap" ? b.lista : null;
      if (!lista) return bad("Lista inválida.");
      if (accion === "entrada-borrar") {
        await cambiarPortada((p) => ({ ...p, [lista]: (p[lista] as Novedad[]).filter((x) => x.id !== b.id) }));
      } else {
        const e = (b.entrada ?? {}) as Record<string, unknown>;
        const id = typeof e.id === "string" && e.id ? e.id : randomUUID();
        const r = limpiarEntrada(e, lista, id);
        if ("error" in r) return bad(r.error);
        await cambiarPortada((p) => {
          const xs = p[lista] as (Novedad | EntradaRoadmap)[];
          const next = xs.some((x) => x.id === id) ? xs.map((x) => (x.id === id ? r.entrada : x)) : [...xs, r.entrada];
          return { ...p, [lista]: next };
        });
      }
    } else if (accion === "contadores-recalcular") {
      revalidateTag(TAG_CONTADORES);
      revalidatePath("/");
      return NextResponse.json(await estado());
    } else {
      return bad("Acción desconocida.");
    }
    refrescar();
    return NextResponse.json(await estado());
  } catch (err) {
    return bad(publicError(err, "No se pudo guardar."), 502);
  }
}
