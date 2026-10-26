import { extDe, type Pieza, type Tanda, zipName } from "./tanda-tipos";

// Meta Ads Manager bulk-import file for a «Primera tanda» (Ads Manager → Export & import → Import ads in bulk).
//
// Column research (25 Oct 2026). Meta has no public, versioned spec of the sheet; the reference is the template
// Ads Manager downloads ("Export & import → Download template") and its exports, where every row is one ad and
// carries its campaign and ad set columns. Header names used here come from:
//   https://adsuploader.com/blog/facebook-ads-bulk-uploads (list of native template headers, read 25 Oct 2026)
//   https://admanage.ai/blog/how-to-create-multiple-ads-on-facebook (row structure, file names must match exactly)
// Notes from those sources: ID columns blank = create; "Image File Name" must match the uploaded image exactly
// (case and extension); statuses ACTIVE/PAUSED; a new campaign needs objective + buying type; a new ad set needs
// country and budget; "Link Object ID" (the Facebook Page, "o:<page id>") and "Instagram Account ID" are needed
// to publish. We don't know the customer's page, Instagram, budget or currency, so those stay blank and the
// LEEME tells them Ads Manager will ask for them before turning anything on. Placement columns follow the API
// fields (publisher_platforms, facebook_positions, instagram_positions) as they appear in exports.
// Choice: two ad sets (feed 4:5 and stories/reels 9:16), each ad with one image, instead of one ad set with
// placement asset customization, which the sheet can't express reliably.

export const META_COLUMNS = [
  "Campaign Name", "Campaign Status", "Campaign Objective", "Buying Type",
  "Ad Set Name", "Ad Set Run Status", "Ad Set Daily Budget", "Optimization Goal", "Billing Event", "Countries",
  "Publisher Platforms", "Facebook Positions", "Instagram Positions",
  "Ad Name", "Ad Status", "Title", "Body", "Link", "Call to Action", "Image File Name",
  "Link Object ID", "Instagram Account ID",
] as const;
type Col = (typeof META_COLUMNS)[number];

const PLACEMENT = {
  "4x5": { set: "Feed 4:5", fb: "feed", ig: "stream" },
  "9x16": { set: "Stories y Reels 9:16", fb: "story, facebook_reels", ig: "story, reels" },
} as const;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();
const firstSentence = (s: string) => oneLine(s).match(/^.*?[.!?](\s|$)/)?.[0].trim() ?? oneLine(s);

/** Primary text of an ad: the headline of the piece plus what the product is. Plain and honest, no AI call. */
export function cuerpo(p: Pieza, t: Tanda): string {
  const t0 = oneLine(p.titular);
  const titular = !t0 || /[.!?…]$/.test(t0) ? t0 : `${t0}.`;
  const desc = clip(firstSentence(t.producto.descripcion), 220);
  const cierre = t.idioma === "en" ? `Learn more about ${t.producto.nombre} at the link.` : `Conoce ${t.producto.nombre} en el link.`;
  return [titular, desc, cierre].filter(Boolean).join(" ");
}

export const nombreCampana = (t: Tanda) => `${clip(oneLine(t.producto.nombre) || "Producto", 60)} · Creads ${t.createdAt.slice(0, 10)}`;
/** The file name as it ends up in the media library: the ZIP name without its folder. */
export const archivoImagen = (p: Pieza, f: "4x5" | "9x16", ext: string) => zipName(p, f, ext).split("/").pop()!;

/** Rows of the import, one ad per finished image; everything PAUSED. */
export function filasMeta(t: Tanda, o: { pais?: string } = {}): Record<Col, string>[] {
  const pais = /^[A-Z]{2}$/.test(o.pais ?? "") ? o.pais! : t.idioma === "en" ? "US" : "CL";
  const campana = nombreCampana(t);
  const cta = t.producto.precio ? "SHOP_NOW" : "LEARN_MORE";
  const rows: Record<Col, string>[] = [];
  for (const f of ["4x5", "9x16"] as const) {
    for (const p of t.piezas) {
      const ref = f === "4x5" ? p.f45 : p.f916;
      if (!ref) continue;
      const file = archivoImagen(p, f, extDe(ref));
      rows.push({
        "Campaign Name": campana, "Campaign Status": "PAUSED", "Campaign Objective": "Outcome Traffic", "Buying Type": "AUCTION",
        "Ad Set Name": `${PLACEMENT[f].set} · ${campana}`, "Ad Set Run Status": "PAUSED", "Ad Set Daily Budget": "",
        "Optimization Goal": "LINK_CLICKS", "Billing Event": "IMPRESSIONS", "Countries": pais,
        "Publisher Platforms": "facebook, instagram", "Facebook Positions": PLACEMENT[f].fb, "Instagram Positions": PLACEMENT[f].ig,
        "Ad Name": file.replace(/\.[a-z0-9]+$/, ""), "Ad Status": "PAUSED",
        "Title": clip(oneLine(t.producto.nombre), 40), "Body": cuerpo(p, t), "Link": t.producto.url,
        "Call to Action": cta, "Image File Name": file, "Link Object ID": "", "Instagram Account ID": "",
      });
    }
  }
  return rows;
}

const cell = (v: string) => (/[",\r\n;]/.test(v) ? `"${v.replace(/"/g, "\"\"")}"` : v);

/** CSV text, UTF-8 with BOM (so Excel shows accents right), CRLF line ends. */
export function csvMeta(t: Tanda, o: { pais?: string } = {}): string {
  const lines = [META_COLUMNS.join(","), ...filasMeta(t, o).map((r) => META_COLUMNS.map((c) => cell(r[c])).join(","))];
  return `﻿${lines.join("\r\n")}\r\n`;
}

export const nombreCsv = (t: Tanda) => `creads-meta-${t.createdAt.slice(0, 10)}.csv`;

/** LEEME.txt that goes inside the ZIP. */
export const LEEME = (csv: string) => [
  "Cómo subir estos anuncios a Meta (Facebook e Instagram)",
  "",
  "1) Sube las imágenes de las carpetas feed-4x5 y stories-reels-9x16 a la biblioteca de contenido de tu cuenta publicitaria",
  "   (Administrador de anuncios → Biblioteca de contenido / Imágenes). No les cambies el nombre.",
  `2) Importa el archivo ${csv} (viene en este ZIP y también se descarga con el botón «Descargar archivo para Meta (CSV)»):`,
  "   Administrador de anuncios → Exportar e importar → Importar anuncios en bloque.",
  "   Se crea 1 campaña con 2 conjuntos: Feed 4:5 y Stories y Reels 9:16, y un anuncio por imagen con el mismo nombre del archivo.",
  "3) Todo parte en PAUSA. Meta te va a pedir completar tu página de Facebook, tu cuenta de Instagram, el país y el presupuesto:",
  "   complétalos, revisa cada anuncio y recién ahí actívalos.",
  "",
  "Hecho con Creads IA · creadsia.com",
].join("\r\n");
