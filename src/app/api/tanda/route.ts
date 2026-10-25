import { NextResponse } from "next/server";
import { after } from "next/server";
import { phCapture } from "@/lib/posthog-server";
import { tooMany } from "@/lib/rate";
import { SESSION_ENDED, session } from "@/lib/access";
import { freeOrLimited } from "@/lib/credits";
import { ownsMedia, saveMedia } from "@/lib/media";
import { textAI } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";
import { FEATURE_UNAVAILABLE } from "@/lib/public-error";
import { sinVoseo } from "@/lib/image-batch";
import { cargarMarca, guardarMarca, marcaBrief } from "@/lib/marca";
import { conLogo } from "@/lib/logo";
import { IDEAS } from "@/lib/ideas";
import { esRubro } from "@/lib/hooks-biblioteca";
import { tandaCompleta } from "@/lib/correos-activacion";
import { correosComportamiento, enviarEmbudo } from "@/lib/embudo-envio";
import {
  type Angulo, type Pieza, type Producto, type Tanda, TIPOS, type TipoAngulo,
  actualizarPieza, angulosPrompt, variacionesPrompt, cargarTanda, fetchPublic, guardarTanda, leerPagina, listarTandas, tandaId, tandaPrompt,
} from "@/lib/tanda";

export const maxDuration = 90;
export const dynamic = "force-dynamic";

// «Primera tanda» (P0, 25 Oct 2026). Reading the page and writing the angles and prompts is free; each image
// is generated (and charged) on its own by /api/generate/image, then reported back here with {accion:"pieza"}.
//   GET                    → the workspace's batches (newest first)       GET ?id=… → one batch
//   {accion:"leer", url | descripcion, idioma, rubro?}    → product + 6 angles (dolor, deseo, mecanismo…)
//   {accion:"crear", producto, angulos, idioma, n}        → a new batch with n pieces (prompt + headline each)
//   {accion:"pieza", id, n, formato, url?, nota?, error?} → saves a finished image (logo of the kit added)

const str = (v: unknown, max: number) => (typeof v === "string" ? sinVoseo(v.trim()).slice(0, max) : "");
const list = (v: unknown, n: number, max: number) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);
const tipo = (v: unknown): TipoAngulo => ((TIPOS as readonly string[]).includes(String(v)) ? (v as TipoAngulo) : "deseo");

function producto(v: unknown, ws: string, url = ""): Producto {
  const p = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  return {
    nombre: str(p.nombre, 120), descripcion: str(p.descripcion, 600), precio: str(p.precio, 40), publico: str(p.publico, 300),
    beneficios: list(p.beneficios, 5, 160), objeciones: list(p.objeciones, 3, 160),
    foto: ownsMedia(p.foto, ws) ? (p.foto as string) : "", url: str(p.url, 500) || url,
  };
}
const angulos = (v: unknown): Angulo[] => (Array.isArray(v) ? v : []).slice(0, 6).map((a: Record<string, unknown>) => ({
  tipo: tipo(a?.tipo), titulo: str(a?.titulo, 90), gancho: str(a?.gancho, 90), por_que: str(a?.por_que, 240),
})).filter((a) => a.titulo || a.gancho);

export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const t = await cargarTanda(s.user.workspace, id);
    return t ? NextResponse.json({ tanda: t }) : NextResponse.json({ error: "No encontramos esa tanda." }, { status: 404 });
  }
  return NextResponse.json({ tandas: await listarTandas(s.user.workspace) });
}

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const ws = s.user.workspace;
  const b = await req.json().catch(() => null);
  const idioma: "es" | "en" = b?.idioma === "en" ? "en" : "es";

  try {
    if (b?.accion === "pieza") {
      const n = Number(b.n), formato = b.formato === "9:16" ? "9:16" : "4:5";
      const t = await cargarTanda(ws, String(b.id));
      if (!t || !t.piezas.some((p) => p.n === n)) return NextResponse.json({ error: "No encontramos esa tanda." }, { status: 404 });
      const patch: Partial<Pieza> = {};
      if (b.url !== undefined) {
        if (!ownsMedia(b.url, ws)) return NextResponse.json({ error: "Imagen inválida." }, { status: 400 });
        const url = await conLogo(ws, b.url, await cargarMarca(ws), formato).catch(() => b.url as string);
        patch[formato === "9:16" ? "f916" : "f45"] = url;
        patch.error = undefined;
      }
      if (typeof b.nota === "string") patch.nota = str(b.nota, 200) || undefined;
      if (typeof b.ganador === "boolean") patch.ganador = b.ganador || undefined;
      if (typeof b.error === "string") patch.error = str(b.error, 300) || undefined;
      const out = await actualizarPieza(ws, t.id, n, patch);
      // «Tu tanda está lista» (behaviour emails, once per person): the image that completed the batch
      if (b.url !== undefined && tandaCompleta(out) && !tandaCompleta(t)) after(() => phCapture(s.user.id, "batch_ready", { tanda: t.id, piezas: out!.piezas.length }, `batch_ready-${t.id}`));
      if (correosComportamiento() && b.url !== undefined && tandaCompleta(out) && !tandaCompleta(t)) {
        await enviarEmbudo(s.user, "tanda-lista", s.user.id, { vars: { n: String(out!.piezas.length), producto: out!.producto.nombre || "tu producto", id: out!.id } })
          .catch((e) => console.error("tanda lista email", e instanceof Error ? e.message : e));
      }
      return NextResponse.json({ ok: true, url: patch.f916 ?? patch.f45 ?? null, tanda: out ?? null });
    }

    const limited = await tooMany("ai", s.user.id);
    if (limited) return limited;
    if (!textAI.configured()) return NextResponse.json({ error: FEATURE_UNAVAILABLE }, { status: 503 });
    const broke = await freeOrLimited(s.user, "script");
    if (broke) return NextResponse.json({ error: broke }, { status: 402 });
    const marca = await cargarMarca(ws);

    if (b?.accion === "leer") {
      const url = str(b.url, 600), descripcion = str(b.descripcion, 2000);
      if (!url && descripcion.length < 15) return NextResponse.json({ error: "Pega el link de tu producto o cuéntanos qué vendes (una o dos frases)." }, { status: 400 });
      const pagina = url ? await leerPagina(url) : undefined;
      if (pagina && pagina.texto.length < 80 && !pagina.descripcion) return NextResponse.json({ error: "No pudimos leer el contenido de esa página (puede que se arme con JavaScript). Describe tu producto en dos frases y seguimos." }, { status: 422 });
      const rubro = esRubro(b.rubro) ? b.rubro : undefined;
      const raw = await textAI.complete({ prompt: angulosPrompt({ pagina, descripcion, brief: marcaBrief(marca), idioma, rubro }), json: true, maxTokens: 2500 });
      const out = parseJSON<{ producto?: unknown; angulos?: unknown }>(raw);
      const prod = producto(out?.producto, ws, pagina?.url ?? "");
      if (!prod.precio && pagina?.precio) prod.precio = pagina.precio;
      // the product photo: the kit's, else the first picture of the page (saved in the customer's files)
      prod.foto = marca.producto.foto;
      if (!prod.foto && pagina?.imagenes.length) {
        for (const img of pagina.imagenes) {
          try {
            const r = await fetchPublic(img, 8_000_000, "image/*");
            if (!/^image\/(jpeg|png|webp)/.test(r.type) || r.bytes.length < 2000) continue;
            prod.foto = await saveMedia(ws, "productos", r.bytes, r.type.split(";")[0]);
            break;
          } catch { /* next picture */ }
        }
      }
      const ang = angulos(out?.angulos);
      if (ang.length < 3 || !prod.nombre) throw new Error("No salieron ángulos.");
      // first time: the product goes into the kit, so every next batch already knows it
      if (!marca.producto.nombre) {
        await guardarMarca(ws, { ...marca, producto: { nombre: prod.nombre, descripcion: prod.descripcion, url: prod.url, precio: prod.precio, foto: prod.foto, publico: prod.publico } }).catch(() => null);
      }
      after(() => phCapture(s.user.id, "angles_generated", { angulos: ang.length, fuente: pagina ? "link" : "descripcion", idioma }));
      return NextResponse.json({ producto: prod, angulos: ang, leido: pagina ? { titulo: pagina.titulo, url: pagina.url } : null });
    }

    if (b?.accion === "crear") {
      const prod = producto(b.producto, ws);
      const ang = angulos(b.angulos);
      const n = Math.min(10, Math.max(1, Math.round(Number(b.n) || 10)));
      if (!prod.nombre || !ang.length) return NextResponse.json({ error: "Elige al menos un ángulo." }, { status: 400 });
      const raw = await textAI.complete({ prompt: tandaPrompt({ producto: prod, angulos: ang, n, brief: marcaBrief(marca), idioma, conFoto: Boolean(prod.foto), formatoIdea: IDEAS.find((i) => i.id === b.idea)?.brief }), json: true, maxTokens: 6000 });
      const out = parseJSON<{ piezas?: Record<string, unknown>[] }>(raw);
      const piezas: Pieza[] = (Array.isArray(out?.piezas) ? out.piezas : []).map((p, i) => ({
        n: i + 1, tipo: tipo(p?.tipo), titular: str(p?.titular, 90), estilo: str(p?.estilo, 4), prompt: typeof p?.prompt === "string" ? p.prompt.trim().slice(0, 2000) : "",
      })).filter((p) => p.prompt.length > 30).slice(0, n);
      if (!piezas.length) throw new Error("No salieron anuncios.");
      const now = new Date().toISOString();
      const t: Tanda = { id: tandaId(), createdAt: now, updatedAt: now, idioma, producto: prod, angulos: ang, piezas };
      await guardarTanda(ws, t);
      after(() => phCapture(s.user.id, "batch_started", { tanda: t.id, piezas: piezas.length, angulos: ang.length, idioma }, `batch_started-${t.id}`));
      return NextResponse.json({ tanda: t });
    }

    if (b?.accion === "variar") {
      const t = await cargarTanda(ws, String(b.id));
      const pieza = t?.piezas.find((p) => p.n === Number(b.n));
      if (!t || !pieza) return NextResponse.json({ error: "No encontramos ese anuncio." }, { status: 404 });
      const n = Math.min(10, Math.max(1, Math.round(Number(b.cuantas) || 10)));
      const raw = await textAI.complete({ prompt: variacionesPrompt({ pieza, producto: t.producto, n, brief: marcaBrief(marca), idioma: t.idioma, conFoto: Boolean(t.producto.foto) }), json: true, maxTokens: 6000 });
      const out = parseJSON<{ piezas?: Record<string, unknown>[] }>(raw);
      const piezas: Pieza[] = (Array.isArray(out?.piezas) ? out.piezas : []).map((p, i) => ({
        n: i + 1, tipo: pieza.tipo, titular: str(p?.titular, 90), estilo: str(p?.estilo, 40), prompt: typeof p?.prompt === "string" ? p.prompt.trim().slice(0, 2000) : "",
      })).filter((p) => p.prompt.length > 30).slice(0, n);
      if (!piezas.length) throw new Error("No salieron variaciones.");
      const now = new Date().toISOString();
      const nueva: Tanda = { id: tandaId(), createdAt: now, updatedAt: now, idioma: t.idioma, producto: t.producto, angulos: t.angulos.filter((a) => a.tipo === pieza.tipo), piezas, origen: { tanda: t.id, n: pieza.n } };
      await guardarTanda(ws, nueva);
      return NextResponse.json({ tanda: nueva });
    }

    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error && /link|página|dirección|archivo|redirige/.test(e.message) ? e.message : "No pudimos preparar tu tanda. Intenta de nuevo en un momento.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
