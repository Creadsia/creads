// «Control» for ad images (owner, 25 Oct 2026: «nadie quiere gastar saldo y recibir algo al azar»).
// Pure logic shared by the browser and the server: the choices the customer makes before generating, the
// prompts (the picture is ALWAYS drawn without text: the headline and the button are put on top by code, so
// they are spelled exactly as typed), the price of every step, and what can be done at each stage.
//
// Flow: controls → «Vista previa» (1 cheap draft, QA) → «Aprobar» (3 final formats drawn FROM the draft, QA,
// text by code) → «Editar con una instrucción» (text/layout: free re-compose; picture: image edit, priced)
// → «Rehacer gratis» with a reason (max 2 per piece) — every redo is logged for the weekly quality email.

import type { FuentePieza } from "./fuente-metricas";

export const FORMATOS_PIEZA = ["4:5", "9:16", "1:1"] as const;
export type FormatoPieza = (typeof FORMATOS_PIEZA)[number];
/** Meta's sizes for each placement. */
export const TAMANO: Record<FormatoPieza, [number, number]> = { "4:5": [1080, 1350], "9:16": [1080, 1920], "1:1": [1080, 1080] };
/** The draft is drawn in 4:5 (the feed, where most ads run). */
export const FORMATO_BORRADOR: FormatoPieza = "4:5";

/**
 * Safe zones (fractions of the frame) where text, logo and button may go. 9:16: Meta's stories/reels UI
 * covers the top 14% and the bottom 20% (prototype, legacy/creads-artifact.html safeZone); feed and square
 * keep a margin so nothing touches the edges.
 */
export const ZONAS: Record<FormatoPieza, { x0: number; x1: number; y0: number; y1: number }> = {
  "4:5": { x0: 0.06, x1: 0.94, y0: 0.05, y1: 0.95 },
  "9:16": { x0: 0.06, x1: 0.94, y0: 0.14, y1: 0.8 },
  "1:1": { x0: 0.06, x1: 0.94, y0: 0.06, y1: 0.94 },
};

export type EstiloPieza = "ugc" | "estudio" | "lifestyle" | "oferta" | "antesdespues" | "advertorial";
export interface EstiloInfo { id: EstiloPieza; label: string; foto: string; fuente: FuentePieza; caja: boolean; fondoCaja: "blanco" | "negro" | "marca" }
export const ESTILOS_PIEZA: EstiloInfo[] = [
  { id: "ugc", label: "UGC (foto de celular)", foto: "An authentic smartphone photo taken by a real customer: casual framing, natural window light, slightly imperfect, everyday real home, not a stock photo.", fuente: "Montserrat ExtraBold", caja: true, fondoCaja: "blanco" },
  { id: "estudio", label: "Estudio", foto: "Premium studio product photography: seamless backdrop, soft key light and gentle reflections, sharp focus on the product, high-end commercial look.", fuente: "Poppins ExtraBold", caja: false, fondoCaja: "marca" },
  { id: "lifestyle", label: "Lifestyle", foto: "Lifestyle photography: a real-looking person using or enjoying the product in a natural, aspirational everyday setting, warm natural light, shallow depth of field.", fuente: "Montserrat ExtraBold", caja: false, fondoCaja: "marca" },
  { id: "oferta", label: "Oferta", foto: "A bold, clean promotional product shot: the product large and centred, simple colourful background using the brand colours, high contrast, eye-catching.", fuente: "Anton", caja: true, fondoCaja: "marca" },
  { id: "antesdespues", label: "Antes / después", foto: "A clear before/after comparison in ONE image split vertically down the middle: left half the problem (before), right half the result with the product (after); same subject, same framing and light so the difference is obvious at a glance.", fuente: "Archivo Black", caja: true, fondoCaja: "negro" },
  { id: "advertorial", label: "Advertorial (tipo noticia)", foto: "Editorial, news-style documentary photo: realistic, candid, the product shown in context like a photo from a magazine or news article, neutral natural colours.", fuente: "Inter Black", caja: true, fondoCaja: "blanco" },
];
export const estiloDe = (id: unknown) => ESTILOS_PIEZA.find((e) => e.id === id) ?? ESTILOS_PIEZA[0];

export type LogoPos = "no" | "arriba-izq" | "arriba-der" | "abajo";
export const LOGO_POS: { id: LogoPos; label: string }[] = [
  { id: "no", label: "Sin logo" }, { id: "arriba-izq", label: "Arriba a la izquierda" }, { id: "arriba-der", label: "Arriba a la derecha" }, { id: "abajo", label: "Abajo al centro" },
];
export type IdiomaPieza = "es-CL" | "es" | "en-US";
export const IDIOMAS_PIEZA: { id: IdiomaPieza; label: string; cta: string; lugar: string }[] = [
  { id: "es-CL", label: "Español de Chile", cta: "Compra aquí", lugar: "Chile (Chilean people, homes, streets and shops)" },
  { id: "es", label: "Español neutro", cta: "Compra ahora", lugar: "Latin America (Latin American people and settings)" },
  { id: "en-US", label: "Inglés (EE. UU.)", cta: "Shop now", lugar: "the United States (American people and settings)" },
];
export const idiomaDe = (id: unknown) => IDIOMAS_PIEZA.find((i) => i.id === id) ?? IDIOMAS_PIEZA[0];

/** What the picture is: changing any of this means drawing again (costs). */
export interface Pedido {
  estilo: EstiloPieza;
  escena: string;          // background / scene, the customer's words (any language)
  idioma: IdiomaPieza;
  producto: { nombre: string; descripcion: string; foto: string }; // foto: the REAL product photo (reference)
  /** severe problems found before (QA or the customer's reason), fed back into the next drawing */
  arreglos?: string[];
}

/** What goes on top of the picture (text, button, logo): changing it is free (only the overlay re-runs). */
export interface Diseno {
  titular: string;         // exact, as typed; *words* between asterisks get the highlight colour
  cta: string;             // button text ("" = no button)
  posicion: "arriba" | "abajo";
  tam: number;             // 0.6–1.5: the customer's «más grande / más chico»
  fuente: FuentePieza;
  caja: boolean;           // text on boxes (native look) or with a soft shadow
  fondoCaja: string;       // box colour
  colorTexto: string;      // "" = automatic contrast
  resaltar: string;        // highlight colour
  colorBoton: string;      // button colour
  logo: string;            // brand logo (media ref) or ""
  logoPos: LogoPos;
}

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v.toUpperCase() : d);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[{}\\]/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "");
const clamp = (v: unknown, lo: number, hi: number, d: number) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

/** Black or white, whichever reads better on `bg`. */
export function contraste(bg: string) {
  const h = HEX.test(bg) ? bg : "#000000";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#000000" : "#FFFFFF";
}

/** The overlay settings a style starts with, in the brand's colours. */
export function disenoInicial(estilo: EstiloPieza, marca: { c1: string; c2: string; logo?: string; logoPos?: string }, idioma: IdiomaPieza): Diseno {
  const e = estiloDe(estilo);
  const c1 = hex(marca.c1, "#8A5CFF"), c2 = hex(marca.c2, "#19E3FF");
  const box = e.fondoCaja === "blanco" ? "#FFFFFF" : e.fondoCaja === "negro" ? "#111111" : c1;
  const pos = String(marca.logoPos ?? "");
  return {
    titular: "", cta: idiomaDe(idioma).cta, posicion: "arriba", tam: 1, fuente: e.fuente, caja: e.caja,
    fondoCaja: box, colorTexto: "", resaltar: c2, colorBoton: c1,
    logo: marca.logo ?? "", logoPos: !marca.logo || pos === "no" ? "no" : pos === "arriba-izq" ? "arriba-izq" : pos.startsWith("abajo") ? "abajo" : "arriba-der",
  };
}

const FUENTES_OK: FuentePieza[] = ["Montserrat ExtraBold", "Poppins ExtraBold", "Archivo Black", "Anton", "Inter Black"];
/** A design from the browser, made safe. `logoOk` says whether a logo ref belongs to the customer. */
export function limpiarDiseno(v: unknown, base: Diseno, logoOk: (ref: string) => boolean = () => false): Diseno {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const logo = typeof o.logo === "string" && (o.logo === "" || logoOk(o.logo)) ? o.logo : base.logo;
  const pos = LOGO_POS.some((p) => p.id === o.logoPos) ? (o.logoPos as LogoPos) : base.logoPos;
  return {
    titular: o.titular === undefined ? base.titular : str(o.titular, 140),
    cta: o.cta === undefined ? base.cta : str(o.cta, 32),
    posicion: o.posicion === "abajo" ? "abajo" : o.posicion === "arriba" ? "arriba" : base.posicion,
    tam: clamp(o.tam, 0.6, 1.5, base.tam),
    fuente: FUENTES_OK.includes(o.fuente as FuentePieza) ? (o.fuente as FuentePieza) : base.fuente,
    caja: typeof o.caja === "boolean" ? o.caja : base.caja,
    fondoCaja: hex(o.fondoCaja, base.fondoCaja),
    colorTexto: o.colorTexto === "" ? "" : hex(o.colorTexto, base.colorTexto),
    resaltar: hex(o.resaltar, base.resaltar),
    colorBoton: hex(o.colorBoton, base.colorBoton),
    logo, logoPos: logo ? pos : "no",
  };
}

/** The picture request from the browser, made safe. */
export function limpiarPedido(v: unknown, fotoOk: (ref: string) => boolean): Pedido {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const p = (o.producto && typeof o.producto === "object" ? o.producto : {}) as Record<string, unknown>;
  return {
    estilo: estiloDe(o.estilo).id,
    escena: str(o.escena, 600),
    idioma: idiomaDe(o.idioma).id,
    producto: { nombre: str(p.nombre, 120), descripcion: str(p.descripcion, 600), foto: typeof p.foto === "string" && fotoOk(p.foto) ? p.foto : "" },
  };
}

// ---------- prompts ----------

const NO_TEXT = "ABSOLUTELY NO TEXT anywhere in the picture: no letters, words, numbers, captions, signs, price tags, watermarks, logos, frames or app interface (the only exception is what is already printed on the real product's own label). The headline and button are added later by our software.";
const PRODUCT_LOCK = "The attached product photo is the REAL product. Show exactly this product: same shape and proportions, same colours, same label, same printed text and logo on it, same cap/packaging. Do not redesign, recolour, simplify or invent a different product, and do not add anything to its label. The product must be clearly visible, in focus, not cut by the edges and not deformed.";

/** The band kept clean for the headline (and the button). */
function banda(f: FormatoPieza, posicion: "arriba" | "abajo") {
  const z = ZONAS[f];
  const top = Math.round(z.y0 * 100), bottom = Math.round((1 - z.y1) * 100);
  const where = posicion === "arriba" ? `the TOP ${Math.round(z.y0 * 100) + 26}% of the frame` : `the BOTTOM ${Math.round((1 - z.y1) * 100) + 26}% of the frame`;
  const ui = f === "9:16" ? ` Meta's interface covers the top ${top}% and the bottom ${bottom}% of a stories/reels image: nothing important there either.` : "";
  return `COMPOSITION FOR A ${TAMANO[f][0]}x${TAMANO[f][1]} AD (${f}): leave ${where} as calm, uncluttered, evenly lit background (wall, sky, table surface, soft blur) with no objects, faces or product in it, so a headline can be placed there; the subject and the product sit in the rest of the frame, fully visible, with clear margins from the sides.${ui}`;
}

/** The clean picture (draft or redo): style, scene, product locked to the reference, empty band, no text. */
export function promptPieza(p: Pedido, f: FormatoPieza, posicion: "arriba" | "abajo") {
  const e = estiloDe(p.estilo), lang = idiomaDe(p.idioma);
  const prod = [p.producto.nombre && `Product: ${p.producto.nombre}.`, p.producto.descripcion && `What it is: ${p.producto.descripcion}`].filter(Boolean).join(" ");
  return [
    `Photorealistic advertising image for paid social (Meta, TikTok). ${e.foto}`,
    p.escena ? `Scene / background (the advertiser's words, follow them): """${p.escena}"""` : "Scene: the most natural place where this product is used.",
    prod,
    p.producto.foto ? PRODUCT_LOCK : "",
    `People and places look like ${lang.lugar}. Only original, real-looking people (no celebrities); natural hands with five fingers; no real brands other than the product itself.`,
    banda(f, posicion),
    NO_TEXT,
    p.arreglos?.length ? `FIX THESE PROBLEMS FROM THE PREVIOUS TRY: ${p.arreglos.slice(-3).join(" ")}` : "",
  ].filter(Boolean).join("\n\n");
}

/** A final format, drawn FROM the approved draft (first reference) so the composition stays. */
export function promptFormato(p: Pedido, f: FormatoPieza, posicion: "arriba" | "abajo") {
  return [
    `The FIRST attached image is the APPROVED draft of this ad. Recreate it as the high-quality final photo in ${f} format: the same scene, the same composition and camera angle, the same person or people (same face, hair, skin tone and clothes), the same product in the same place, the same lighting and colours. Only extend or trim the background so it fits the ${f} frame, and render everything sharper and more detailed. Do not add, remove or move objects.`,
    p.producto.foto ? `The SECOND attached image is the real product. ${PRODUCT_LOCK}` : "",
    banda(f, posicion),
    NO_TEXT,
    p.arreglos?.length ? `FIX THESE PROBLEMS FROM THE PREVIOUS TRY: ${p.arreglos.slice(-3).join(" ")}` : "",
  ].filter(Boolean).join("\n\n");
}

/** «Editar con una instrucción» on the picture: the current image is the one being edited. */
export function promptEdicion(p: Pedido, instruccionEn: string, f: FormatoPieza, posicion: "arriba" | "abajo") {
  return [
    `Edit the FIRST attached image. Change ONLY this: ${instruccionEn}`,
    "Keep everything else IDENTICAL: composition, framing, people (same faces), the product, light and colours.",
    p.producto.foto ? `The SECOND attached image is the real product: it must stay exactly like it (shape, colours, label, logo).` : "",
    banda(f, posicion),
    NO_TEXT,
  ].filter(Boolean).join("\n\n");
}

/** Automatic QA before delivering (extends the image review of «Varias imágenes»). */
export function qaPrompt(p: Pedido) {
  return `You are the final quality check of an ad image before a paying customer sees it. The FIRST image is the generated picture.${p.producto.foto ? " The SECOND image is the REAL product photo." : ""}
The picture must have NO text at all (our software adds the headline later) and ${p.producto.foto ? "must show exactly the real product" : `should show: ${p.producto.nombre || "the advertised product"}`}.
Style asked: ${estiloDe(p.estilo).label}. Scene asked: ${p.escena || "(free)"}.
Mark "grave": true ONLY for problems a customer would reject:
1) ${p.producto.foto ? "the product is different from the real one (other shape, colour, label or logo), deformed, melted, duplicated, or missing" : "the product is missing or deformed"};
2) deformed hands (extra or missing fingers), melted or distorted faces, extra limbs, broken bodies;
3) letters, words, numbers, garbled text, watermarks, logos or app interface drawn in the picture (except the product's own label);
4) a person or the product badly cut by the edge.
Small style differences are NOT grave.
Return JSON only: {"ok": true|false, "grave": true|false, "problema": "if not ok: one short sentence in Spanish (Chile, tú) saying what is wrong", "fix_en": "if not ok: a short English instruction to fix it in the next try"}`;
}

/** Reasons the customer can give for «Rehacer gratis» → the instruction added to the next try. */
export const MOTIVOS_REHACER = [
  { id: "texto", label: "Texto con errores", fix: "There must be NO letters or text drawn anywhere in the picture (also no fake signs or labels); keep the reserved band completely clean." },
  { id: "producto", label: "Producto deformado o distinto", fix: "The product must be EXACTLY the one in the reference photo: same shape, proportions, colours, label and logo, undistorted, in focus and fully visible." },
  { id: "manos", label: "Manos o caras raras", fix: "Anatomically correct people: natural hands with exactly five fingers, natural faces and bodies, nothing melted or duplicated; if hands are hard, keep them out of frame." },
  { id: "otro", label: "Otro", fix: "" },
] as const;
export type MotivoRehacer = (typeof MOTIVOS_REHACER)[number]["id"];
export const motivoDe = (id: unknown) => MOTIVOS_REHACER.find((m) => m.id === id) ?? MOTIVOS_REHACER[3];

// ---------- «Editar con una instrucción» ----------

export interface CambiosDiseno { titular?: string; cta?: string; tam?: "mas" | "menos"; posicion?: "arriba" | "abajo"; caja?: boolean; colorTexto?: string; resaltar?: string; colorBoton?: string; logoPos?: LogoPos }
export type Interpretacion = { tipo: "diseno"; cambios: CambiosDiseno } | { tipo: "imagen"; instruccion: string };

/** For Claude: is the instruction about the overlay (free) or about the picture (costs), and what exactly. */
export function interpretarPrompt(instruccion: string, d: Diseno) {
  return `An ad image has a PICTURE (drawn by AI) and an OVERLAY drawn by our software on top: headline "${d.titular}", button "${d.cta}", logo position ${d.logoPos}, text position ${d.posicion}, text on boxes: ${d.caja}.
The customer asks (any language): """${instruccion}"""
Decide:
- "diseno" if it only touches the overlay: the headline's or the button's words, text size, text up/down, boxes on/off, text/highlight/button colours, logo position. Put ONLY the changes in "cambios": {"titular"?: exact new headline (keep *asterisks* around highlighted words if they ask to highlight), "cta"?: exact new button text ("" removes it), "tam"?: "mas"|"menos", "posicion"?: "arriba"|"abajo", "caja"?: true|false, "colorTexto"?: "#RRGGBB", "resaltar"?: "#RRGGBB", "colorBoton"?: "#RRGGBB", "logoPos"?: "no"|"arriba-izq"|"arriba-der"|"abajo"}.
- "imagen" if anything in the picture must change (background, person, objects, light, product placement, removing something). Put a precise English edit instruction in "instruccion".
Return JSON only: {"tipo":"diseno","cambios":{...}} or {"tipo":"imagen","instruccion":"..."}`;
}

/** Claude's answer, made safe (unknown fields dropped). Null when it makes no sense. */
export function limpiarInterpretacion(v: unknown): Interpretacion | null {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  if (o.tipo === "imagen") { const i = str(o.instruccion, 600); return i.length >= 4 ? { tipo: "imagen", instruccion: i } : null; }
  if (o.tipo !== "diseno") return null;
  const c = (o.cambios && typeof o.cambios === "object" ? o.cambios : {}) as Record<string, unknown>;
  const out: CambiosDiseno = {};
  if (typeof c.titular === "string" && str(c.titular, 140)) out.titular = str(c.titular, 140);
  if (typeof c.cta === "string") out.cta = str(c.cta, 32);
  if (c.tam === "mas" || c.tam === "menos") out.tam = c.tam;
  if (c.posicion === "arriba" || c.posicion === "abajo") out.posicion = c.posicion;
  if (typeof c.caja === "boolean") out.caja = c.caja;
  for (const k of ["colorTexto", "resaltar", "colorBoton"] as const) if (typeof c[k] === "string" && HEX.test(c[k] as string)) out[k] = (c[k] as string).toUpperCase();
  if (LOGO_POS.some((p) => p.id === c.logoPos)) out.logoPos = c.logoPos as LogoPos;
  return Object.keys(out).length ? { tipo: "diseno", cambios: out } : null;
}

const COLORES: Record<string, string> = { blanco: "#FFFFFF", white: "#FFFFFF", negro: "#000000", black: "#000000", amarillo: "#FFD400", yellow: "#FFD400", rojo: "#E53935", red: "#E53935", verde: "#22C55E", green: "#22C55E", azul: "#2563EB", blue: "#2563EB", rosado: "#FF2BD6", rosa: "#FF2BD6", pink: "#FF2BD6", morado: "#8A5CFF", violeta: "#8A5CFF", purple: "#8A5CFF", naranjo: "#FF8A00", naranja: "#FF8A00", orange: "#FF8A00", celeste: "#19E3FF" };
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Without the AI (or if it fails): simple words → overlay changes; anything else is a picture edit. */
export function interpretarLocal(instruccion: string): Interpretacion {
  const t = norm(instruccion);
  const quoted = instruccion.match(/[«"“']([^»"”']{1,140})[»"”']/)?.[1]?.trim();
  const about = (re: RegExp) => re.test(t);
  const color = Object.keys(COLORES).find((k) => new RegExp(`\\b${k}\\b`).test(t));
  const c: CambiosDiseno = {};
  const isButton = about(/\b(boton|cta|button)\b/);
  const isText = about(/\b(texto|titular|letra|letras|frase|titulo|headline|text)\b/);
  if (quoted && isButton) c.cta = quoted;
  else if (quoted && isText) c.titular = quoted;
  if (about(/\b(sin|quita\w*|saca\w*|elimina\w*|remove)\b.*\bboton\b/)) c.cta = "";
  if ((isText || isButton || !t.match(/fondo|persona|producto/)) && about(/mas grande|agranda|bigger|larger|mas visible/)) c.tam = "mas";
  if ((isText || isButton || !t.match(/fondo|persona|producto/)) && about(/mas (chic|pequen)|achica|smaller|mas fino/)) c.tam = "menos";
  if ((isText) && about(/\babajo\b|\bbottom\b/)) c.posicion = "abajo";
  if ((isText) && about(/\barriba\b|\btop\b/)) c.posicion = "arriba";
  if (about(/\blogo\b/)) {
    if (about(/sin logo|quita\w* el logo|saca\w* el logo|no logo/)) c.logoPos = "no";
    else if (about(/izquierda|left/)) c.logoPos = "arriba-izq";
    else if (about(/derecha|right/)) c.logoPos = "arriba-der";
    else if (about(/abajo|bottom/)) c.logoPos = "abajo";
  }
  if (about(/sin (caja|recuadro|fondo del texto)/)) c.caja = false;
  if (about(/con (caja|recuadro)/)) c.caja = true;
  if (color && (isText || isButton || about(/resalt/))) {
    if (isButton) c.colorBoton = COLORES[color];
    else if (about(/resalt/)) c.resaltar = COLORES[color];
    else c.colorTexto = COLORES[color];
  }
  if (Object.keys(c).length) return { tipo: "diseno", cambios: c };
  return { tipo: "imagen", instruccion: instruccion.trim().slice(0, 600) };
}

/** Applies overlay changes (free) to a design. */
export function aplicarCambios(d: Diseno, c: CambiosDiseno): Diseno {
  const tam = c.tam === "mas" ? Math.min(1.5, +(d.tam * 1.2).toFixed(2)) : c.tam === "menos" ? Math.max(0.6, +(d.tam / 1.2).toFixed(2)) : d.tam;
  return {
    ...d, tam,
    ...(c.titular !== undefined ? { titular: c.titular } : {}),
    ...(c.cta !== undefined ? { cta: c.cta } : {}),
    ...(c.posicion ? { posicion: c.posicion } : {}),
    ...(c.caja !== undefined ? { caja: c.caja } : {}),
    ...(c.colorTexto ? { colorTexto: c.colorTexto } : {}),
    ...(c.resaltar ? { resaltar: c.resaltar } : {}),
    ...(c.colorBoton ? { colorBoton: c.colorBoton } : {}),
    ...(c.logoPos ? { logoPos: d.logo ? c.logoPos : "no" } : {}),
  };
}

// ---------- prices ----------

export interface ModeloPrecio { id: string; label: string; usd: number; configured: boolean }
/** The draft model: the cheapest one that's on. */
export function modeloBorrador(ms: ModeloPrecio[]) {
  return [...ms].filter((m) => m.configured && m.usd > 0).sort((a, b) => a.usd - b.usd)[0] ?? null;
}
/** The final model: the one asked for if it's on, else Nano Banana 2, else the cheapest on. */
export function modeloFinal(ms: ModeloPrecio[], pedido?: string) {
  const on = ms.filter((m) => m.configured && m.usd > 0);
  return on.find((m) => m.id === pedido) ?? on.find((m) => m.id === "nano-banana-2") ?? modeloBorrador(ms);
}
/** What each step costs (US$ of model cost, shown to the customer as credits). Overlay and free redos: 0. */
export function costosPasos(borradorUsd: number, finalUsd: number) {
  return {
    vistaPrevia: +borradorUsd.toFixed(4),
    aprobar: +(finalUsd * FORMATOS_PIEZA.length).toFixed(4),
    editarTexto: 0,
    editarImagen: +finalUsd.toFixed(4),
    rehacer: 0,
  };
}

// ---------- the job and what can be done at each stage ----------

export const MAX_REHACER_GRATIS = 2;   // manual free redos per piece
export const MAX_AUTO_PIEZA = 1;       // automatic (QA) redos per piece
export const MAX_AUTO_TRABAJO = 3;     // automatic redos per job (draft + 3 formats)
export const MAX_BORRADORES = 6;       // paid drafts per job (then start a new one)

export type ClavePieza = "borrador" | FormatoPieza;
export interface Pieza {
  uid: string;             // trabajo:pieza:version, for the quality log
  limpia: string;         // the picture without text (what edits and redos start from)
  final: string;           // the picture with the overlay (what the customer downloads)
  modelo: string;
  intentos: number;        // drawings of this piece (1 = first try)
  auto: number;            // automatic QA redos used
  rehechos: number;        // manual free redos used
  ediciones: number;       // paid picture edits
  nota?: string;           // QA note shown when it still wasn't perfect
}
export interface Trabajo {
  id: string;
  ws: string;
  creado: string;
  pedido: Pedido;
  diseno: Diseno;
  modeloBorrador: string;
  modeloFinal: string;
  etapa: "borrador" | "final";
  borradores: number;
  autoTrabajo: number;
  piezas: Partial<Record<ClavePieza, Pieza>>;
  historial: { at: string; que: string; creditos: number; detalle?: string }[];
}

export type Accion = "vista-previa" | "aprobar" | "diseno" | "editar-imagen" | "rehacer";

/** Null when the action is allowed at this stage, else the reason (in Spanish, for the customer). */
export function puede(t: Trabajo | null, a: Accion, pieza?: ClavePieza): string | null {
  if (a === "vista-previa") {
    if (t && t.etapa === "final") return "Esta imagen ya está aprobada. Para otra idea, empieza una nueva.";
    if (t && t.borradores >= MAX_BORRADORES) return "Ya hiciste varias vistas previas de esta imagen. Empieza una nueva con otros datos.";
    return null;
  }
  if (!t) return "Primero haz la vista previa.";
  if (a === "aprobar") {
    // approved again only to finish formats that failed (and were refunded)
    if (t.etapa === "final" && faltantes(t).length === 0) return "Ya está aprobada.";
    return t.piezas.borrador ? null : "Primero haz la vista previa.";
  }
  if (a === "diseno") return t.piezas.borrador || t.etapa === "final" ? null : "Primero haz la vista previa.";
  const k = pieza ?? (t.etapa === "final" ? "4:5" : "borrador");
  const p = t.piezas[k];
  if (!p) return "Esa pieza no existe.";
  if (a === "editar-imagen") return null;
  if (a === "rehacer") return p.rehechos >= MAX_REHACER_GRATIS ? `Esta pieza ya usó sus ${MAX_REHACER_GRATIS} rehechos gratis. Puedes editarla con una instrucción.` : null;
  return "Acción desconocida.";
}

/** The final formats not made yet. */
export const faltantes = (t: Pick<Trabajo, "piezas">) => FORMATOS_PIEZA.filter((f) => !t.piezas[f]);

/** After the QA: redo once more for free automatically? */
export function rehacerAuto(qa: { ok: boolean; grave: boolean }, p: Pick<Pieza, "auto">, t: Pick<Trabajo, "autoTrabajo">) {
  return !qa.ok && qa.grave && p.auto < MAX_AUTO_PIEZA && t.autoTrabajo < MAX_AUTO_TRABAJO;
}

const NOMBRE_PIEZA: Record<string, string> = { borrador: "Vista previa", "4:5": "Feed 4:5", "9:16": "Historias 9:16", "1:1": "Cuadrada 1:1", diseno: "Texto y diseño" };
export const nombrePieza = (k: string) => NOMBRE_PIEZA[k] ?? k;

/** Strips the highlight markup: the exact words that will be printed. */
export const textoPlano = (titular: string) => titular.replace(/\*/g, "").replace(/\s+/g, " ").trim();
