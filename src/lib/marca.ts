import { readPrivateJSON, writePrivateJSON } from "./supabase";
import { ownsMedia } from "./media";

// «Kit de marca» (owner's plan, 25 Oct 2026): the customer loads logo, colours, tone and product once and
// every batch of ads uses them (prompts, logo on the images, colours of the video edit).
// Kept as a small private file per workspace: no database change.

import { MARCA_VACIA, type Marca, TONOS, type Tono } from "./marca-tipos";
export * from "./marca-tipos";

const file = (ws: string) => `marca/${ws}.json`;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : d);
const httpUrl = (v: unknown) => { const s = str(v, 500); return /^https?:\/\/[^\s]+$/i.test(s) ? s : ""; };

/** A kit from the browser, made safe (only the customer's own files, known values). */
export function limpiarMarca(v: unknown, ws: string): Marca {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const p = (o.producto && typeof o.producto === "object" ? o.producto : {}) as Record<string, unknown>;
  const pos = ["arriba-izq", "arriba-der", "abajo-izq", "abajo-der", "no"] as const;
  return {
    nombre: str(o.nombre, 80),
    logo: ownsMedia(o.logo, ws) ? (o.logo as string) : "",
    logoPos: (pos as readonly string[]).includes(String(o.logoPos)) ? (o.logoPos as Marca["logoPos"]) : "arriba-der",
    c1: hex(o.c1, MARCA_VACIA.c1), c2: hex(o.c2, MARCA_VACIA.c2),
    tono: (TONOS as readonly string[]).includes(String(o.tono)) ? (o.tono as Tono) : "cercano",
    notas: str(o.notas, 400),
    idioma: o.idioma === "en" ? "en" : "es",
    producto: {
      nombre: str(p.nombre, 120), descripcion: str(p.descripcion, 1200), url: httpUrl(p.url), precio: str(p.precio, 40),
      foto: ownsMedia(p.foto, ws) ? (p.foto as string) : "", publico: str(p.publico, 300),
    },
  };
}

export async function cargarMarca(ws: string): Promise<Marca> {
  const m = await readPrivateJSON<Marca>(file(ws)).catch(() => null);
  return m ? { ...MARCA_VACIA, ...m, producto: { ...MARCA_VACIA.producto, ...(m.producto ?? {}) } } : { ...MARCA_VACIA, producto: { ...MARCA_VACIA.producto } };
}

export async function guardarMarca(ws: string, m: Marca) {
  const out = { ...m, updatedAt: new Date().toISOString() };
  await writePrivateJSON(file(ws), out);
  return out;
}

/** True once the customer has set anything of their own. */
export const marcaLista = (m: Marca) => Boolean(m.nombre || m.logo || m.producto.nombre);

const TONO_EN: Record<Tono, string> = {
  cercano: "warm and close, like a friend recommending it",
  profesional: "professional and trustworthy",
  divertido: "playful and funny",
  premium: "premium, elegant and calm",
  directo: "direct and punchy, no fluff",
};

/** The brand, as a short brief for the AI that writes the ads. */
export function marcaBrief(m: Marca) {
  const lines = [
    m.nombre && `Brand name: ${m.nombre}`,
    `Brand colours: ${m.c1} and ${m.c2} (use them in backgrounds, text boxes and accents)`,
    `Tone of voice: ${TONO_EN[m.tono]}`,
    m.notas && `Brand notes (follow them): ${m.notas}`,
    m.producto.nombre && `Product: ${m.producto.nombre}${m.producto.precio ? ` (price ${m.producto.precio})` : ""}`,
    m.producto.descripcion && `What it is: ${m.producto.descripcion}`,
    m.producto.publico && `Who buys it: ${m.producto.publico}`,
  ];
  return lines.filter(Boolean).join("\n");
}
