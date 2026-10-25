import { randomUUID } from "node:crypto";
import { findImage, imageProviders, textAI } from "./providers";
import { parseJSON } from "./providers/claude";
import type { MediaRef } from "./providers/types";
import { fetchableUrl, saveMedia } from "./media";
import { readPrivateJSON, sbRest, sbRpc, writePrivateJSON } from "./supabase";
import { payFor } from "./paid";
import { CreditError, refundJob } from "./credits";
import { serviceOfModel } from "./balances";
import type { User } from "./auth";
import type { Db } from "./db";
import { registrarImagen } from "./calidad-imagen";
import { renderPieza } from "./pieza-render";
import {
  type ClavePieza, type Diseno, FORMATO_BORRADOR, type FormatoPieza, type ModeloPrecio, type Pedido, type Pieza, type Trabajo,
  aplicarCambios, faltantes, interpretarLocal, interpretarPrompt, limpiarInterpretacion, modeloBorrador, motivoDe,
  promptEdicion, promptFormato, promptPieza, qaPrompt, rehacerAuto, textoPlano, type Interpretacion, type MotivoRehacer,
} from "./control-imagen";

// «Control» for ad images, server side: the job (a small private JSON per image), charging each step, drawing
// through the image providers (never directly), the automatic QA with one free redo, the overlay by code and
// the quality log. The route (/api/imagenes/control) only checks the session and calls these.

export interface Ctx { user: User; db: Db }

export function modelosImagen(): ModeloPrecio[] {
  return imageProviders.map((p) => ({ id: p.id, label: p.label, usd: p.usdPerImage, configured: p.configured() }));
}

const archivo = (ws: string, id: string) => `control-imagen/${ws}/${id}.json`;
export const idValido = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/.test(id);

export async function cargarTrabajo(ws: string, id: string) {
  if (!idValido(id)) return null;
  const t = await readPrivateJSON<Trabajo>(archivo(ws, id)).catch(() => null);
  return t && t.ws === ws ? t : null;
}
export const guardarTrabajo = (t: Trabajo) => writePrivateJSON(archivo(t.ws, t.id), t);

/** One request at a time per image: a double click never charges twice. False when it's already busy. */
export async function ocupar(id: string) {
  return sbRpc<boolean>("hit_rate", { p_key: `ctrl-img:${id}`, p_window: 300, p_max: 1 }).then(Boolean).catch(() => true);
}
export async function soltar(id: string) {
  await sbRest(`rate_limits?key=eq.${encodeURIComponent(`ctrl-img:${id}`)}`, { method: "DELETE", headers: { prefer: "return=minimal" } }).catch(() => {});
}

async function bytesDe(ref: string, ws: string) {
  const res = await fetch(await fetchableUrl(ref, ws, 600), { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error("No se pudo leer la imagen.");
  return new Uint8Array(await res.arrayBuffer());
}

function proveedor(id: string) {
  const p = findImage(id);
  if (!p || !p.configured()) throw new CreditError("Ese modelo de imagen no está disponible por ahora. Intenta en un rato.", 503);
  return p;
}

/** Draws one clean picture and stores it. Its real cost is recorded (daily limit, «Tus creaciones»), even when free for the customer. */
async function dibujar(ctx: Ctx, modelo: string, prompt: string, aspect: FormatoPieza, refs: MediaRef[]) {
  const ws = ctx.user.workspace;
  const p = proveedor(modelo);
  const open = await Promise.all(refs.filter((r) => r.url).map(async (r) => ({ ...r, url: await fetchableUrl(r.url, ws) })));
  const { bytes, mime } = await p.generate({ prompt, aspect, refs: open });
  const ref = await saveMedia(ws, "images", bytes, mime);
  await ctx.db.insert("clips", { kind: "gen:image", prompt: prompt.slice(0, 2000), model: p.label, status: "done", url: ref, usd: p.usdPerImage }).catch(() => null);
  return ref;
}

export interface Qa { ok: boolean; grave: boolean; problema: string; fix: string }
/** Automatic QA before delivering. If the reviewer can't run, the piece goes out (never blocks). */
async function revisar(ctx: Ctx, t: Trabajo, ref: string): Promise<Qa> {
  const pass = { ok: true, grave: false, problema: "", fix: "" };
  if (!textAI.configured()) return pass;
  try {
    const ws = ctx.user.workspace;
    const images = [await fetchableUrl(ref, ws, 600)];
    if (t.pedido.producto.foto) images.push(await fetchableUrl(t.pedido.producto.foto, ws, 600));
    const raw = await textAI.complete({ prompt: qaPrompt(t.pedido), images, json: true, maxTokens: 400 });
    const r = parseJSON<{ ok?: unknown; grave?: unknown; problema?: unknown; fix_en?: unknown }>(raw);
    const ok = r?.ok !== false;
    const s = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
    return { ok, grave: !ok && r?.grave !== false, problema: s(r?.problema, 200), fix: s(r?.fix_en, 400) };
  } catch (err) {
    console.error("control-imagen qa", err instanceof Error ? err.message : err);
    return pass;
  }
}

/** The overlay on a clean picture → the downloadable piece (free). */
async function componer(ctx: Ctx, d: Diseno, clave: ClavePieza, limpia: string) {
  const ws = ctx.user.workspace;
  const f = clave === "borrador" ? FORMATO_BORRADOR : clave;
  const [img, logo] = await Promise.all([bytesDe(limpia, ws), d.logo && d.logoPos !== "no" ? bytesDe(d.logo, ws).catch(() => null) : Promise.resolve(null)]);
  const { bytes } = await renderPieza(img, d, f, logo);
  return saveMedia(ws, "images", bytes, "image/jpeg");
}

/**
 * Draw → QA → (one free automatic redo if the QA finds a severe problem) → overlay. `previo` keeps the
 * counters of a piece being redone or edited; `nueva` logs it as a new piece (first-try rate).
 */
async function producir(ctx: Ctx, t: Trabajo, clave: ClavePieza, o: { prompt: (arreglos: string[]) => string; refs: MediaRef[]; modelo: string; previo?: Pieza; nueva: boolean; arreglos?: string[] }) {
  const aspect = clave === "borrador" ? FORMATO_BORRADOR : clave;
  const uid = o.previo?.uid ?? `${t.id}:${clave}:${t.borradores}`;
  let arreglos = [...(o.arreglos ?? [])];
  let limpia = await dibujar(ctx, o.modelo, o.prompt(arreglos), aspect, o.refs);
  let qa = await revisar(ctx, t, limpia);
  const pieza: Pieza = o.previo ? { ...o.previo, limpia, intentos: o.previo.intentos + 1 } : { uid, limpia, final: "", modelo: o.modelo, intentos: 1, auto: 0, rehechos: 0, ediciones: 0 };
  const primerOk = qa.ok;
  if (rehacerAuto(qa, pieza, t)) {
    pieza.auto++;
    t.autoTrabajo++;
    await registrarImagen({ ws: t.ws, evento: "auto", uid, pieza: clave, estilo: t.pedido.estilo, modelo: o.modelo, motivo: qa.problema || "error grave" });
    arreglos = [...arreglos, qa.fix || qa.problema].filter(Boolean);
    try {
      const otra = await dibujar(ctx, o.modelo, o.prompt(arreglos), aspect, o.refs);
      const qa2 = await revisar(ctx, t, otra);
      limpia = otra; qa = qa2; pieza.intentos++;
    } catch (err) {
      console.error("control-imagen auto redo", err instanceof Error ? err.message : err); // keep the first one, with its note
    }
  }
  pieza.limpia = limpia;
  pieza.modelo = o.modelo;
  pieza.nota = qa.ok ? undefined : qa.problema || "Revisa esta imagen antes de usarla.";
  pieza.final = await componer(ctx, t.diseno, clave, limpia);
  if (o.nueva) await registrarImagen({ ws: t.ws, evento: "pieza", uid, pieza: clave, estilo: t.pedido.estilo, modelo: o.modelo, primerOk, nota: qa.ok ? undefined : qa.problema });
  return pieza;
}

const productoRef = (p: Pedido): MediaRef[] => (p.producto.foto ? [{ url: p.producto.foto, role: "product" }] : []);
const nota = (que: string, creditos: number, detalle?: string) => ({ at: new Date().toISOString(), que, creditos, ...(detalle ? { detalle: detalle.slice(0, 300) } : {}) });

/** «Vista previa»: one cheap draft (the cheapest model that's on), QA, text on top. Paid. */
export async function vistaPrevia(ctx: Ctx, previo: Trabajo | null, pedido: Pedido, diseno: Diseno, modeloFinal: string) {
  const mb = modeloBorrador(modelosImagen());
  if (!mb) throw new CreditError("Los modelos de imagen no están disponibles por ahora. Intenta en un rato.", 503);
  const t: Trabajo = previo
    ? { ...previo, pedido, diseno, modeloBorrador: mb.id, modeloFinal }
    : { id: randomUUID(), ws: ctx.user.workspace, creado: new Date().toISOString(), pedido, diseno, modeloBorrador: mb.id, modeloFinal, etapa: "borrador", borradores: 0, autoTrabajo: 0, piezas: {}, historial: [] };
  const p = proveedor(mb.id);
  const charge = await payFor(ctx.user, p.usdPerImage, `Imagen · vista previa (${p.label})`, serviceOfModel(p.id));
  try {
    t.borradores++;
    const pieza = await producir(ctx, t, "borrador", { prompt: (a) => promptPieza({ ...pedido, arreglos: a }, FORMATO_BORRADOR, diseno.posicion), refs: productoRef(pedido), modelo: mb.id, nueva: true });
    t.piezas = { borrador: pieza };
    t.historial.push(nota("Vista previa", charge.credits));
    await guardarTrabajo(t);
    return { trabajo: t, creditos: charge.credits };
  } catch (err) {
    await refundJob(ctx.user.workspace, charge.ref);
    throw err;
  }
}

/** «Aprobar»: the 3 final formats drawn FROM the approved draft (it goes first as reference). One charge per format: a failed one gives its credits back. */
export async function aprobar(ctx: Ctx, t: Trabajo) {
  const ws = ctx.user.workspace;
  const p = proveedor(t.modeloFinal);
  const todo = faltantes(t);
  const cargos: { f: FormatoPieza; ref: string; credits: number }[] = [];
  try {
    for (const f of todo) {
      const c = await payFor(ctx.user, p.usdPerImage, `Imagen final ${f} (${p.label})`, serviceOfModel(p.id));
      cargos.push({ f, ref: c.ref, credits: c.credits });
    }
  } catch (err) {
    for (const c of cargos) await refundJob(ws, c.ref, "Devuelto: no alcanzó para los 3 formatos");
    throw err;
  }
  const draft = t.piezas.borrador!;
  const refs: MediaRef[] = [{ url: draft.limpia, role: "style" }, ...productoRef(t.pedido)];
  const res = await Promise.allSettled(todo.map((f) => producir(ctx, t, f, { prompt: (a) => promptFormato({ ...t.pedido, arreglos: a }, f, t.diseno.posicion), refs, modelo: p.id, nueva: true })));
  let creditos = 0, error: unknown = null;
  for (const [i, r] of res.entries()) {
    const c = cargos[i];
    if (r.status === "fulfilled") {
      t.piezas[c.f] = r.value;
      creditos += c.credits;
      await ctx.db.insert("images", { prompt: textoPlano(t.diseno.titular) || t.pedido.escena || "Imagen", url: r.value.final, model: p.id, aspect: c.f }).catch(() => null);
    } else {
      error = r.reason;
      console.error("control-imagen final", c.f, r.reason instanceof Error ? r.reason.message : r.reason);
      await refundJob(ws, c.ref);
    }
  }
  if (!res.some((r) => r.status === "fulfilled")) throw error ?? new Error("No se pudieron hacer las imágenes finales.");
  t.etapa = "final";
  t.historial.push(nota(`Aprobada: ${todo.filter((f) => t.piezas[f]).join(", ")}`, creditos));
  await guardarTrabajo(t);
  return { trabajo: t, creditos, fallaron: todo.filter((f) => !t.piezas[f]) };
}

/** Text or layout changed: only the overlay runs again, on every piece (free). */
export async function recomponer(ctx: Ctx, t: Trabajo, d: Diseno) {
  t.diseno = d;
  const claves = Object.keys(t.piezas) as ClavePieza[];
  await Promise.all(claves.map(async (k) => { t.piezas[k] = { ...t.piezas[k]!, final: await componer(ctx, d, k, t.piezas[k]!.limpia) }; }));
  t.historial.push(nota("Texto o diseño", 0));
  await guardarTrabajo(t);
  return { trabajo: t, creditos: 0 };
}

/** What an instruction means: overlay (free) or picture (priced). Claude when available, simple rules otherwise. */
export async function interpretar(instruccion: string, d: Diseno): Promise<Interpretacion> {
  if (textAI.configured()) {
    try {
      const raw = await textAI.complete({ prompt: interpretarPrompt(instruccion, d), json: true, maxTokens: 400, fast: true });
      const r = limpiarInterpretacion(parseJSON(raw));
      if (r) return r;
    } catch (err) {
      console.error("control-imagen interpretar", err instanceof Error ? err.message : err);
    }
  }
  return interpretarLocal(instruccion);
}

export const precioEdicion = (t: Trabajo, clave: ClavePieza) => proveedor(t.piezas[clave]?.modelo ?? t.modeloFinal).usdPerImage;

/** «Editar con una instrucción» on the picture: the current image is edited (paid, price shown first). */
export async function editarImagen(ctx: Ctx, t: Trabajo, clave: ClavePieza, instruccionEn: string, original: string) {
  const previo = t.piezas[clave]!;
  const p = proveedor(previo.modelo);
  const f = clave === "borrador" ? FORMATO_BORRADOR : clave;
  const charge = await payFor(ctx.user, p.usdPerImage, `Imagen · edición (${p.label})`, serviceOfModel(p.id));
  try {
    const refs: MediaRef[] = [{ url: previo.limpia, role: "style" }, ...productoRef(t.pedido)];
    const pieza = await producir(ctx, t, clave, { prompt: () => promptEdicion(t.pedido, instruccionEn, f, t.diseno.posicion), refs, modelo: p.id, previo, nueva: false });
    pieza.ediciones++;
    t.piezas[clave] = pieza;
    t.historial.push(nota(`Edición ${clave}`, charge.credits, original));
    await registrarImagen({ ws: t.ws, evento: "edicion", uid: pieza.uid, pieza: clave, estilo: t.pedido.estilo, modelo: p.id, motivo: "imagen", nota: original });
    await guardarTrabajo(t);
    return { trabajo: t, creditos: charge.credits };
  } catch (err) {
    await refundJob(ctx.user.workspace, charge.ref);
    throw err;
  }
}

/** Overlay edit from an instruction: applied and logged. */
export async function editarDiseno(ctx: Ctx, t: Trabajo, i: Extract<Interpretacion, { tipo: "diseno" }>, original: string) {
  const out = await recomponer(ctx, t, aplicarCambios(t.diseno, i.cambios));
  await registrarImagen({ ws: t.ws, evento: "edicion", uid: `${t.id}:diseno`, pieza: "diseno", estilo: t.pedido.estilo, motivo: "texto", nota: original });
  return out;
}

/** «Rehacer gratis» with a reason: zero charge, max 2 per piece, logged. A format is redrawn from the approved draft. */
export async function rehacer(ctx: Ctx, t: Trabajo, clave: ClavePieza, motivo: MotivoRehacer, detalle: string) {
  const previo = t.piezas[clave]!;
  const m = motivoDe(motivo);
  const fix = [m.fix, detalle && `The customer says: ${detalle}`].filter(Boolean).join(" ");
  await registrarImagen({ ws: t.ws, evento: "manual", uid: previo.uid, pieza: clave, estilo: t.pedido.estilo, modelo: previo.modelo, motivo: m.label, nota: detalle });
  const refs: MediaRef[] = clave === "borrador" ? productoRef(t.pedido) : [{ url: t.piezas.borrador!.limpia, role: "style" }, ...productoRef(t.pedido)];
  const prompt = (a: string[]) => (clave === "borrador" ? promptPieza({ ...t.pedido, arreglos: a }, FORMATO_BORRADOR, t.diseno.posicion) : promptFormato({ ...t.pedido, arreglos: a }, clave, t.diseno.posicion));
  const pieza = await producir(ctx, t, clave, { prompt, refs, modelo: previo.modelo, previo: { ...previo, rehechos: previo.rehechos + 1 }, nueva: false, arreglos: [fix] });
  t.piezas[clave] = pieza;
  t.historial.push(nota(`Rehecho gratis ${clave}: ${m.label}`, 0, detalle));
  await guardarTrabajo(t);
  return { trabajo: t, creditos: 0 };
}
