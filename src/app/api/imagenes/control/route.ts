import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { fullSession } from "@/lib/access";
import { ownsMedia } from "@/lib/media";
import { cargarMarca } from "@/lib/marca";
import { failMessage, failStatus } from "@/lib/paid";
import {
  type ClavePieza, FORMATOS_PIEZA, type Trabajo, costosPasos, disenoInicial, limpiarDiseno, limpiarPedido, modeloBorrador, modeloFinal, motivoDe, puede,
} from "@/lib/control-imagen";
import {
  aprobar, cargarTrabajo, editarDiseno, editarImagen, idValido, interpretar, modelosImagen, ocupar, precioEdicion, recomponer, rehacer, soltar, vistaPrevia,
} from "@/lib/control-imagen-server";

export const maxDuration = 300;

// «Control» for ad images (owner, 25 Oct 2026). Every paid step shows its price first; the text is put on
// top by code. GET → prices, models and the brand kit defaults (or ?id= a job). POST {accion}:
//   vista-previa {id?, pedido, diseno, modeloFinal?}   1 cheap draft (paid)
//   aprobar      {id, diseno?}                        the 3 final formats from the draft (paid, one charge per format)
//   diseno       {id, diseno}                         text / layout only (free)
//   editar       {id, pieza, instruccion, confirmar?} free when it's text; a picture edit answers its price first
//   rehacer      {id, pieza, motivo, detalle?}        free redo with a reason (max 2 per piece)

const vista = (t: Trabajo) => { const { ws: _ws, ...rest } = t; void _ws; return rest; };
const precios = (modeloFinalId?: string) => {
  const ms = modelosImagen();
  const b = modeloBorrador(ms), f = modeloFinal(ms, modeloFinalId);
  return { modelos: ms.filter((m) => m.configured), borrador: b, final: f, costos: costosPasos(b?.usd ?? 0, f?.usd ?? 0) };
};

export async function GET(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const t = await cargarTrabajo(s.user.workspace, id);
    if (!t) return NextResponse.json({ error: "No encontramos esa imagen." }, { status: 404 });
    return NextResponse.json({ trabajo: vista(t), ...precios(t.modeloFinal) });
  }
  const marca = await cargarMarca(s.user.workspace).catch(() => null);
  return NextResponse.json({
    ...precios(),
    marca: marca ? { nombre: marca.nombre, c1: marca.c1, c2: marca.c2, logo: marca.logo, logoPos: marca.logoPos, idioma: marca.idioma, producto: { nombre: marca.producto.nombre, descripcion: marca.producto.descripcion, foto: marca.producto.foto } } : null,
  });
}

export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const ws = s.user.workspace;
  const b = await req.json().catch(() => null);
  const accion = String(b?.accion ?? "");
  const paid = accion === "vista-previa" || accion === "aprobar" || (accion === "editar" && b?.confirmar) || accion === "rehacer";
  if (paid) { const limited = await tooMany("gen", s.user.id); if (limited) return limited; }
  const own = (ref: string) => ownsMedia(ref, ws);

  const t = idValido(b?.id) ? await cargarTrabajo(ws, b.id) : null;
  if (b?.id && !t) return NextResponse.json({ error: "No encontramos esa imagen. Empieza de nuevo." }, { status: 404 });
  // one request at a time per image (a new one: per person), so a double click never charges twice
  const lock = t ? t.id : `nuevo-${s.user.id}`;
  if (!(await ocupar(lock))) return NextResponse.json({ error: "Esta imagen ya se está haciendo. Espera a que termine." }, { status: 409 });
  const ctx = { user: s.user, db: s.db };
  try {
    if (accion === "vista-previa") {
      const no = puede(t, "vista-previa");
      if (no) return NextResponse.json({ error: no }, { status: 409 });
      const pedido = limpiarPedido(b?.pedido, own);
      if (!pedido.escena && !pedido.producto.nombre && !pedido.producto.foto) return NextResponse.json({ error: "Cuenta qué producto es o describe la escena." }, { status: 400 });
      const marca = await cargarMarca(ws).catch(() => null);
      const base = t?.diseno ?? disenoInicial(pedido.estilo, { c1: marca?.c1 ?? "", c2: marca?.c2 ?? "", logo: marca?.logo ?? "", logoPos: marca?.logoPos }, pedido.idioma);
      const diseno = limpiarDiseno(b?.diseno, base, own);
      if (!diseno.titular) return NextResponse.json({ error: "Escribe el titular tal cual quieres que aparezca." }, { status: 400 });
      const mf = precios(typeof b?.modeloFinal === "string" ? b.modeloFinal : t?.modeloFinal).final;
      if (!mf) return NextResponse.json({ error: "Los modelos de imagen no están disponibles por ahora." }, { status: 503 });
      const r = await vistaPrevia(ctx, t, pedido, diseno, mf.id);
      return NextResponse.json({ trabajo: vista(r.trabajo), creditos: r.creditos });
    }

    if (!t) return NextResponse.json({ error: "Primero haz la vista previa." }, { status: 400 });

    if (accion === "aprobar") {
      const no = puede(t, "aprobar");
      if (no) return NextResponse.json({ error: no }, { status: 409 });
      if (b?.diseno) t.diseno = limpiarDiseno(b.diseno, t.diseno, own);
      const r = await aprobar(ctx, t);
      return NextResponse.json({ trabajo: vista(r.trabajo), creditos: r.creditos, fallaron: r.fallaron });
    }

    if (accion === "diseno") {
      const no = puede(t, "diseno");
      if (no) return NextResponse.json({ error: no }, { status: 409 });
      const d = limpiarDiseno(b?.diseno, t.diseno, own);
      if (!d.titular) return NextResponse.json({ error: "El titular no puede quedar vacío." }, { status: 400 });
      const r = await recomponer(ctx, t, d);
      return NextResponse.json({ trabajo: vista(r.trabajo), creditos: 0 });
    }

    const clave = (b?.pieza === "borrador" || FORMATOS_PIEZA.includes(b?.pieza) ? b.pieza : t.etapa === "final" ? "4:5" : "borrador") as ClavePieza;

    if (accion === "editar") {
      const instruccion = typeof b?.instruccion === "string" ? b.instruccion.trim().slice(0, 500) : "";
      if (instruccion.length < 3) return NextResponse.json({ error: "Escribe qué quieres cambiar." }, { status: 400 });
      const no = puede(t, "editar-imagen", clave);
      if (no) return NextResponse.json({ error: no }, { status: 409 });
      // the customer already saw the price of this exact picture edit: do it
      if (b?.confirmar && typeof b?.imagen === "string" && b.imagen.trim().length >= 4) {
        const r = await editarImagen(ctx, t, clave, b.imagen.trim().slice(0, 600), instruccion);
        return NextResponse.json({ trabajo: vista(r.trabajo), creditos: r.creditos, tipo: "imagen" });
      }
      const i = await interpretar(instruccion, t.diseno);
      if (i.tipo === "diseno") {
        const r = await editarDiseno(ctx, t, i, instruccion);
        return NextResponse.json({ trabajo: vista(r.trabajo), creditos: 0, tipo: "diseno" });
      }
      // a picture change: say what it costs and wait for «Confirmar»
      return NextResponse.json({ tipo: "imagen", confirmar: true, imagen: i.instruccion, costoUsd: precioEdicion(t, clave), pieza: clave });
    }

    if (accion === "rehacer") {
      const no = puede(t, "rehacer", clave);
      if (no) return NextResponse.json({ error: no }, { status: 409 });
      const detalle = typeof b?.detalle === "string" ? b.detalle.trim().slice(0, 300) : "";
      const r = await rehacer(ctx, t, clave, motivoDe(b?.motivo).id, detalle);
      return NextResponse.json({ trabajo: vista(r.trabajo), creditos: 0 });
    }

    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (err) {
    console.error("imagenes/control", accion, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: await failMessage(err, s.user) }, { status: failStatus(err) });
  } finally {
    await soltar(lock);
  }
}
