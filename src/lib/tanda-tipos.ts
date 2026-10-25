// Types and labels of «Primera tanda», safe for the browser (src/lib/tanda.ts has the server side).

export const TIPOS = ["dolor", "deseo", "mecanismo", "prueba_social", "creencia", "oferta"] as const;
export type TipoAngulo = (typeof TIPOS)[number];
export const TIPO_LABEL: Record<TipoAngulo, string> = {
  dolor: "Dolor", deseo: "Deseo", mecanismo: "Mecanismo", prueba_social: "Prueba social", creencia: "Creencia", oferta: "Oferta",
};

export interface Producto { nombre: string; descripcion: string; precio: string; publico: string; beneficios: string[]; objeciones: string[]; foto: string; url: string }
export interface Angulo { tipo: TipoAngulo; titulo: string; gancho: string; por_que: string }
export interface Pieza { n: number; tipo: TipoAngulo; titular: string; estilo: string; prompt: string; f45?: string; f916?: string; nota?: string; error?: string }
export interface Tanda { id: string; createdAt: string; updatedAt: string; idioma: "es" | "en"; producto: Producto; angulos: Angulo[]; piezas: Pieza[] }

// ---------- file names of the ZIP (shared with the Meta bulk-import CSV, so names line up) ----------

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "anuncio";
/** «feed-4x5/03-dolor-tu-espalda-no-aguanta-mas.jpg» */
export const zipName = (p: Pieza, f: "4x5" | "9x16", ext: string) =>
  `${f === "4x5" ? "feed-4x5" : "stories-reels-9x16"}/${String(p.n).padStart(2, "0")}-${p.tipo.replace("_", "-")}-${slug(p.titular)}-${f}.${ext}`;

/** Image extension from a media ref («…/uuid.png»), else from the content type, else jpg. */
export function extDe(ref: string, contentType = ""): "jpg" | "png" | "webp" {
  const m = ref.split("?")[0].match(/\.(jpe?g|png|webp)$/i)?.[1]?.toLowerCase();
  if (m) return m === "jpeg" ? "jpg" : (m as "jpg" | "png" | "webp");
  return contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
}

