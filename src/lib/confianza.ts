// «Confianza» blocks of the home page: gallery «Hecho con Creads», real counters, support promise, payment
// badges, changelog (/novedades) and roadmap (/roadmap). GOLDEN RULE: nothing invented. Every block hides
// itself completely when there is no real data, so this file only has pure, client-safe logic (no server
// imports): validation of what the admin saves, filters, thresholds and the tiny text format.

// ---------- gallery ----------

export const NICHOS_GALERIA = [
  ["belleza", "Belleza"],
  ["hogar", "Hogar"],
  ["mascotas", "Mascotas"],
  ["suplementos", "Suplementos"],
  ["moda", "Moda"],
  ["tecnologia", "Tecnología"],
  ["afiliados", "Ofertas de afiliados"],
] as const;
export type NichoGaleria = (typeof NICHOS_GALERIA)[number][0];

export const TIPOS_GALERIA = [
  ["imagen", "Imagen"],
  ["video-producto", "Video de producto"],
  ["avatar", "Avatar"],
] as const;
export type TipoGaleria = (typeof TIPOS_GALERIA)[number][0];

export const FORMATOS_GALERIA = ["4:5", "9:16"] as const;
export type FormatoGaleria = (typeof FORMATOS_GALERIA)[number];

export const nichoLabel = (n: string) => NICHOS_GALERIA.find(([k]) => k === n)?.[1] ?? "";
export const tipoLabel = (t: string) => TIPOS_GALERIA.find(([k]) => k === t)?.[1] ?? "";

/** What is stored (private file): `ref` / `poster` are private media links of Creadsia's workspace. */
export interface GaleriaItem {
  id: string;
  nicho: NichoGaleria;
  tipo: TipoGaleria;
  media: "image" | "video";
  formato: FormatoGaleria;
  ref: string;
  poster?: string;
  caption: string;
  creado: string;
}

/** What the public page gets: never the storage path, only the public gallery route. */
export interface GaleriaPublicaItem {
  id: string;
  nicho: NichoGaleria;
  nichoLabel: string;
  tipo: TipoGaleria;
  tipoLabel: string;
  media: "image" | "video";
  formato: FormatoGaleria;
  src: string;
  poster?: string;
  caption: string;
}

/** Only files uploaded into the gallery folder of Creadsia's own workspace may be listed. */
export const GALERIA_PREFIX = "/api/media/ws/main/portada/";
export const esArchivoGaleria = (ref: unknown): ref is string =>
  typeof ref === "string" && ref.length < 300 && ref.startsWith(GALERIA_PREFIX) && /^[a-z0-9._-]+$/i.test(ref.slice(GALERIA_PREFIX.length)) && !ref.includes("..");
export const mediaDeArchivo = (ref: string): "image" | "video" | null => {
  const ext = ref.split(".").pop()?.toLowerCase() ?? "";
  return ["png", "jpg", "jpeg", "webp"].includes(ext) ? "image" : ["mp4", "mov", "webm"].includes(ext) ? "video" : null;
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, max) : "");
const ID = /^[a-z0-9-]{6,40}$/;

/** A gallery item from the admin, made safe; an error message (Spanish) when something is missing. */
export function limpiarItemGaleria(v: unknown, id: string, now = new Date()): { item: GaleriaItem } | { error: string } {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  if (!esArchivoGaleria(o.ref)) return { error: "Falta el archivo (sube una imagen o un video)." };
  const media = mediaDeArchivo(o.ref);
  if (!media) return { error: "El archivo tiene que ser JPG, PNG, WEBP, MP4, MOV o WEBM." };
  if (!NICHOS_GALERIA.some(([k]) => k === o.nicho)) return { error: "Elige el nicho." };
  if (!TIPOS_GALERIA.some(([k]) => k === o.tipo)) return { error: "Elige el tipo." };
  if (!ID.test(id)) return { error: "Identificador inválido." };
  const poster = media === "video" && esArchivoGaleria(o.poster) && mediaDeArchivo(o.poster) === "image" ? o.poster : undefined;
  return {
    item: {
      id, nicho: o.nicho as NichoGaleria, tipo: o.tipo as TipoGaleria, media,
      formato: (FORMATOS_GALERIA as readonly string[]).includes(String(o.formato)) ? (o.formato as FormatoGaleria) : media === "video" ? "9:16" : "4:5",
      ref: o.ref, ...(poster ? { poster } : {}), caption: str(o.caption, 140),
      creado: typeof o.creado === "string" && !Number.isNaN(Date.parse(o.creado)) ? o.creado : now.toISOString(),
    },
  };
}

/** Public shape (no storage paths). */
export const itemPublico = (i: GaleriaItem): GaleriaPublicaItem => ({
  id: i.id, nicho: i.nicho, nichoLabel: nichoLabel(i.nicho), tipo: i.tipo, tipoLabel: tipoLabel(i.tipo), media: i.media, formato: i.formato,
  src: `/api/galeria/${i.id}`, ...(i.poster ? { poster: `/api/galeria/${i.id}?poster=1` } : {}), caption: i.caption,
});

/** Niches that have at least one item, in the fixed order (the filter chips: never an empty chip). */
export function nichosConItems(items: { nicho: string }[]): [NichoGaleria, string][] {
  return NICHOS_GALERIA.filter(([k]) => items.some((i) => i.nicho === k)).map(([k, l]) => [k, l]);
}

/** Items of a niche ("todos" or empty = all), keeping the admin's order. */
export function filtrarPorNicho<T extends { nicho: string }>(items: T[], nicho: string | null | undefined): T[] {
  return !nicho || nicho === "todos" ? items : items.filter((i) => i.nicho === nicho);
}

/** Moves an item one place up (-1) or down (+1). */
export function mover<T extends { id: string }>(items: T[], id: string, dir: -1 | 1): T[] {
  const i = items.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= items.length) return items;
  const out = [...items];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

// ---------- changelog and roadmap ----------

export const ESTADOS_ROADMAP = [
  ["en-curso", "En curso"],
  ["planeado", "Planeado"],
  ["listo", "Listo"],
] as const;
export type EstadoRoadmap = (typeof ESTADOS_ROADMAP)[number][0];
export const estadoLabel = (e: string) => ESTADOS_ROADMAP.find(([k]) => k === e)?.[1] ?? "";

export interface Novedad { id: string; fecha: string; titulo: string; texto: string }
export interface EntradaRoadmap extends Novedad { estado: EstadoRoadmap }
export type Lista = "novedades" | "roadmap";

/** A real calendar date written YYYY-MM-DD. */
export function fechaValida(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** A changelog or roadmap entry from the admin, made safe. Text keeps its line breaks (simple format). */
export function limpiarEntrada(v: unknown, lista: Lista, id: string): { entrada: Novedad | EntradaRoadmap } | { error: string } {
  const o = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  if (!ID.test(id)) return { error: "Identificador inválido." };
  if (!fechaValida(o.fecha)) return { error: "La fecha tiene que ser real (AAAA-MM-DD)." };
  const titulo = str(o.titulo, 90);
  if (titulo.length < 3) return { error: "Escribe un título." };
  const texto = typeof o.texto === "string" ? o.texto.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, 1200) : "";
  const base: Novedad = { id, fecha: o.fecha, titulo, texto };
  if (lista === "novedades") return { entrada: base };
  if (!ESTADOS_ROADMAP.some(([k]) => k === o.estado)) return { error: "Elige el estado: planeado, en curso o listo." };
  return { entrada: { ...base, estado: o.estado as EstadoRoadmap } };
}

/** Newest first (same date: the one saved later first, by keeping the original order reversed). */
export function ordenarEntradas<T extends { fecha: string }>(xs: T[]): T[] {
  return xs.map((x, i) => [x, i] as const).sort((a, b) => b[0].fecha.localeCompare(a[0].fecha) || b[1] - a[1]).map(([x]) => x);
}

/** Roadmap grouped by status (in progress, planned, done); empty groups left out. */
export function roadmapPorEstado(xs: EntradaRoadmap[]) {
  return ESTADOS_ROADMAP.map(([k, l]) => ({ estado: k, label: l, entradas: ordenarEntradas(xs.filter((x) => x.estado === k)) })).filter((g) => g.entradas.length);
}

/** "2026-10-25" → "25 de octubre de 2026". */
export const fechaLarga = (s: string) => (fechaValida(s) ? new Date(`${s}T12:00:00Z`).toLocaleDateString("es-CL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : s);

// Tiny text format for entries: blank line = new paragraph, lines starting with "- " = list,
// **bold** and [text](https://link). Rendered as React nodes (never raw HTML).
export type Trozo = { t: string; b?: true; href?: string };
export type Bloque = { tipo: "p"; trozos: Trozo[] } | { tipo: "ul"; items: Trozo[][] };

export function enLinea(s: string): Trozo[] {
  const out: Trozo[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) out.push({ t: s.slice(last, m.index) });
    out.push(m[1] !== undefined ? { t: m[1], b: true } : { t: m[2], href: m[3] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: s.slice(last) });
  return out;
}

export function bloquesTexto(texto: string): Bloque[] {
  const out: Bloque[] = [];
  for (const par of texto.split(/\n\s*\n/)) {
    const lines = par.split("\n").map((l) => l.trim()).filter(Boolean);
    let p: string[] = [];
    let ul: Trozo[][] = [];
    const flushP = () => { if (p.length) out.push({ tipo: "p", trozos: enLinea(p.join(" ")) }); p = []; };
    const flushUl = () => { if (ul.length) out.push({ tipo: "ul", items: ul }); ul = []; };
    for (const l of lines) {
      if (/^[-*•]\s+/.test(l)) { flushP(); ul.push(enLinea(l.replace(/^[-*•]\s+/, ""))); }
      else { flushUl(); p.push(l); }
    }
    flushP(); flushUl();
  }
  return out;
}

// ---------- counters ----------

export interface ContadoresCrudos { anuncios: number; marcas: number; actualizado: string }
export interface Contador { id: "anuncios" | "marcas"; valor: number; texto: string; etiqueta: string }

const umbral = (v: string | undefined, d: number) => { const n = Number(v); return v !== undefined && v.trim() !== "" && Number.isFinite(n) && n >= 1 ? Math.floor(n) : d; };
export const umbralesContadores = (env: Record<string, string | undefined>) => ({
  anuncios: umbral(env.CONTADOR_MIN_ANUNCIOS, 1000),
  marcas: umbral(env.CONTADOR_MIN_MARCAS, 50),
});

/** Rounded DOWN, never up (1.234 → «1.200+», 57 → «50+»): the number shown is always true. */
export function formatoContador(n: number) {
  const v = Math.floor(n);
  if (v < 10) return String(v);
  const step = v < 100 ? 10 : 10 ** (String(v).length - 2);
  return `${(Math.floor(v / step) * step).toLocaleString("es-CL")}+`;
}

/** Only the counters at or above their threshold; [] = hide the whole block. */
export function contadoresVisibles(raw: ContadoresCrudos | null, env: Record<string, string | undefined>): Contador[] {
  if (!raw) return [];
  const min = umbralesContadores(env);
  const out: Contador[] = [];
  if (raw.anuncios > 0 && raw.anuncios >= min.anuncios) out.push({ id: "anuncios", valor: raw.anuncios, texto: formatoContador(raw.anuncios), etiqueta: "anuncios hechos con Creads" });
  if (raw.marcas > 0 && raw.marcas >= min.marcas) out.push({ id: "marcas", valor: raw.marcas, texto: formatoContador(raw.marcas), etiqueta: "marcas creando en los últimos 30 días" });
  return out;
}

/**
 * Brand kits in use, from the file names in the private folder «marca/» (src/lib/marca.ts):
 * `<ws>.json` is slot 1, `<ws>-2.json` / `<ws>-3.json` slots 2-3, `<ws>-activa.json` is not a kit.
 * A kit counts when its workspace produced something since `since`, or the kit itself was saved since then.
 * Creadsia's own workspace and test accounts never count.
 */
export function marcasActivas(files: { name: string; updated_at?: string | null }[], activos: Set<string>, since: string, excluir: string[] = []) {
  let n = 0;
  for (const f of files) {
    const m = /^([a-z0-9][a-z0-9-]{2,40})\.json$/.exec(f.name);
    if (!m || m[1].endsWith("-activa")) continue;
    const slotWs = /^(.+)-[23]$/.exec(m[1])?.[1];
    const cands = [m[1], ...(slotWs ? [slotWs] : [])];
    if (cands.some((c) => c === "main" || excluir.includes(c))) continue;
    if (cands.some((c) => activos.has(c)) || (f.updated_at && f.updated_at >= since)) n++;
  }
  return n;
}

// ---------- support and payments ----------

export const PROMESA_DEFAULT = "Respondemos en menos de 12 horas hábiles";
/** The support promise: SOPORTE_PROMESA, the default when unset or blank, hidden when set to "-". */
export function promesaSoporte(env: Record<string, string | undefined>) {
  const t = (env.SOPORTE_PROMESA ?? "").trim().slice(0, 120);
  return !t ? PROMESA_DEFAULT : t === "-" ? "" : t;
}

export type MetodoPago = "mercadopago" | "stripe";
/**
 * Payment methods that really work: Mercado Pago with its access token (server) or public key (browser);
 * Stripe only when both its keys exist. In the browser only NEXT_PUBLIC_ values are known, so Stripe shows
 * there only when the server passes the list.
 */
export function metodosPago(env: Record<string, string | undefined>): MetodoPago[] {
  const out: MetodoPago[] = [];
  if (env.MP_ACCESS_TOKEN || env.NEXT_PUBLIC_MP_PUBLIC_KEY) out.push("mercadopago");
  if (env.STRIPE_SECRET_KEY && env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) out.push("stripe");
  return out;
}
