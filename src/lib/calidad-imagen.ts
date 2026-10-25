import { readPrivateJSON, updatePrivateJSON } from "./supabase";
import { nombrePieza } from "./control-imagen";

// Image quality log (owner, 25 Oct 2026): every piece delivered by «Control» and every redo (automatic by the
// QA, or «Rehacer gratis» by the customer) with the type of piece and the reason. Kept as one small private
// JSON file per month (no database change). The Panel and the weekly email show the «primer intento OK» rate
// per type of piece; the goal is 90%.

export const META_PRIMER_INTENTO = 0.9;

export type EventoImagen = "pieza" | "auto" | "manual" | "edicion";
export interface RegistroImagen {
  at: string;
  ws: string;
  evento: EventoImagen;
  uid: string;            // trabajo:pieza:version — the same piece across its redos
  pieza: string;          // borrador | 4:5 | 9:16 | 1:1
  estilo: string;
  modelo?: string;
  primerOk?: boolean;     // «pieza»: the QA passed on the first drawing
  motivo?: string;        // auto/manual: why; edicion: texto | imagen
  nota?: string;
}

const archivo = (d: Date) => `calidad-imagenes/${d.toISOString().slice(0, 7)}.json`;
const MAX_FILAS = 20_000;

/** Appends one row (never throws: the log never breaks a delivery). */
export async function registrarImagen(r: Omit<RegistroImagen, "at">) {
  const row: RegistroImagen = { ...r, at: new Date().toISOString(), nota: r.nota?.slice(0, 200) };
  await updatePrivateJSON<RegistroImagen[]>(archivo(new Date()), (cur) => [...(cur ?? []), row].slice(-MAX_FILAS))
    .catch((e) => console.error("calidad-imagen log", e instanceof Error ? e.message : e));
}

/** The rows of the last `dias` days (this month's file and the ones before it, as needed). */
export async function leerRegistros(dias: number, ahora = new Date()): Promise<RegistroImagen[]> {
  const desde = ahora.getTime() - dias * 86400_000;
  const meses = new Set<string>();
  for (let t = desde; t <= ahora.getTime() + 86400_000; t += 86400_000 * 20) meses.add(archivo(new Date(t)));
  meses.add(archivo(ahora));
  const all = await Promise.all([...meses].map((m) => readPrivateJSON<RegistroImagen[]>(m).catch(() => null)));
  return all.flat().filter((r): r is RegistroImagen => Boolean(r && Date.parse(r.at) >= desde));
}

export interface FilaTipo { tipo: string; piezas: number; primerOk: number; tasa: number | null; auto: number; manual: number }
export interface ResumenImagenes {
  dias: number;
  total: FilaTipo;
  porPieza: FilaTipo[];
  porEstilo: FilaTipo[];
  motivos: { motivo: string; veces: number }[];
  ediciones: { texto: number; imagen: number };
  meta: number;
}

/**
 * «Primer intento OK» = the piece passed the automatic QA on its first drawing AND the customer didn't ask
 * for a free redo. Pure (tested).
 */
export function resumirImagenes(rows: RegistroImagen[], dias: number): ResumenImagenes {
  const piezas = rows.filter((r) => r.evento === "pieza");
  const manualUid = new Set(rows.filter((r) => r.evento === "manual").map((r) => r.uid));
  const fila = (tipo: string, ps: RegistroImagen[]): FilaTipo => {
    const uids = new Set(ps.map((p) => p.uid));
    const ok = ps.filter((p) => p.primerOk && !manualUid.has(p.uid)).length;
    return {
      tipo, piezas: ps.length, primerOk: ok, tasa: ps.length ? ok / ps.length : null,
      auto: rows.filter((r) => r.evento === "auto" && uids.has(r.uid)).length,
      manual: rows.filter((r) => r.evento === "manual" && uids.has(r.uid)).length,
    };
  };
  const agrupar = (key: (r: RegistroImagen) => string) => {
    const g = new Map<string, RegistroImagen[]>();
    for (const p of piezas) g.set(key(p), [...(g.get(key(p)) ?? []), p]);
    return [...g.entries()].map(([k, ps]) => fila(k, ps)).sort((a, b) => b.piezas - a.piezas);
  };
  const motivos = new Map<string, number>();
  for (const r of rows) if ((r.evento === "auto" || r.evento === "manual") && r.motivo) {
    const k = `${r.evento === "auto" ? "Revisión automática" : "Cliente"}: ${r.motivo}`.slice(0, 140);
    motivos.set(k, (motivos.get(k) ?? 0) + 1);
  }
  return {
    dias,
    total: fila("Todas", piezas),
    porPieza: agrupar((r) => r.pieza),
    porEstilo: agrupar((r) => r.estilo),
    motivos: [...motivos.entries()].map(([motivo, veces]) => ({ motivo, veces })).sort((a, b) => b.veces - a.veces).slice(0, 12),
    ediciones: { texto: rows.filter((r) => r.evento === "edicion" && r.motivo === "texto").length, imagen: rows.filter((r) => r.evento === "edicion" && r.motivo === "imagen").length },
    meta: META_PRIMER_INTENTO,
  };
}

const pct = (x: number | null) => (x == null ? "—" : `${Math.round(x * 100)}%`);
const escHtml = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

/** The weekly email to the owner (plain Spanish). Pure. */
export function correoSemanal(r: ResumenImagenes) {
  const ok = r.total.tasa != null && r.total.tasa >= r.meta;
  const subject = `Calidad de imágenes: ${pct(r.total.tasa)} salió bien al primer intento (meta ${pct(r.meta)})`;
  const linea = (f: FilaTipo, nombre: string) => `${nombre}: ${pct(f.tasa)} bien al primer intento (${f.primerOk} de ${f.piezas}) · ${f.auto} rehechos automáticos · ${f.manual} rehechos pedidos por clientes`;
  const lines = [
    `Últimos ${r.dias} días, imágenes hechas con «Control» (vista previa + 3 formatos).`,
    "",
    linea(r.total, "Total"),
    ok ? "Vamos sobre la meta." : r.total.piezas ? "Estamos bajo la meta: abajo están los motivos más comunes." : "Todavía no hay imágenes en este periodo.",
    "",
    "Por tipo de pieza:",
    ...r.porPieza.map((f) => `- ${linea(f, nombrePieza(f.tipo))}`),
    "",
    "Por estilo:",
    ...r.porEstilo.map((f) => `- ${linea(f, f.tipo)}`),
    "",
    r.motivos.length ? "Motivos de rehechos:" : "",
    ...r.motivos.map((m) => `- ${m.motivo} (${m.veces})`),
    "",
    `Ediciones con instrucción: ${r.ediciones.texto} de texto (gratis), ${r.ediciones.imagen} de imagen.`,
    "Detalle en el Panel → Plataforma → Calidad.",
  ];
  const text = lines.join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${lines.map((l) => (l ? `<p style="margin:0 0 6px">${escHtml(l)}</p>` : "<br>")).join("")}</div>`;
  return { subject, text, html };
}
