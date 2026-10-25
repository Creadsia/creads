import { strToU8, zipSync } from "fflate";
import { META_COLUMNS, csvMeta } from "./tanda-meta";
import type { Tanda } from "./tanda-tipos";

// «Plantilla de Meta» (owner's plan, block E «Herramientas gratis»): the same bulk-import sheet that a
// «Primera tanda» downloads (columns and rules in src/lib/tanda-meta.ts), filled with an EXAMPLE product so
// people see how each row looks, plus the instructions. Given on /plantilla-meta in exchange for an email.

/** The 4 steps, shown on the page and written in the LEEME of the ZIP. */
export const PASOS_PLANTILLA = [
  ["Cambia las filas de ejemplo", "Cada fila es un anuncio. Pon el nombre de tu campaña, el texto, el título, el link y el nombre exacto de cada imagen (con su extensión: .jpg, .png). Borra las filas que no uses."],
  ["Sube tus imágenes a Meta", "En el Administrador de anuncios, abre la biblioteca de contenido de tu cuenta publicitaria y sube las imágenes con el mismo nombre que pusiste en la columna «Image File Name»."],
  ["Importa el archivo", "Administrador de anuncios → Exportar e importar → Importar anuncios en bloque. Elige este archivo (CSV) y revisa la vista previa."],
  ["Completa y activa", "Todo parte en pausa. Meta te va a pedir tu página de Facebook, tu cuenta de Instagram, el país y el presupuesto. Complétalos, revisa cada anuncio y recién ahí actívalos."],
] as const;

const EJEMPLO_FECHA = "2026-01-01T12:00:00.000Z";

/** An example batch: one made-up product, three ads, each in feed 4:5 and stories/reels 9:16. */
export const TANDA_EJEMPLO: Tanda = {
  id: "t_ejemplo0001", createdAt: EJEMPLO_FECHA, updatedAt: EJEMPLO_FECHA, idioma: "es",
  producto: {
    nombre: "Botella térmica (ejemplo)",
    descripcion: "Botella de acero que mantiene el agua fría por horas. Cambia este texto por la descripción de tu producto.",
    precio: "$14.990", publico: "", beneficios: [], objeciones: [], foto: "", url: "https://www.tu-tienda.com/producto",
  },
  angulos: [],
  piezas: [
    { n: 1, tipo: "dolor", titular: "¿Tu agua se calienta a media mañana?", estilo: "a", prompt: "", f45: "ejemplo.jpg", f916: "ejemplo.jpg" },
    { n: 2, tipo: "deseo", titular: "Agua fría todo el día", estilo: "b", prompt: "", f45: "ejemplo.jpg", f916: "ejemplo.jpg" },
    { n: 3, tipo: "oferta", titular: "Envío a todo Chile", estilo: "c", prompt: "", f45: "ejemplo.jpg", f916: "ejemplo.jpg" },
  ],
};

export const NOMBRE_PLANTILLA = "plantilla-meta-creads.zip";
export const CSV_PLANTILLA = "plantilla-meta-anuncios-en-bloque.csv";

export const LEEME_PLANTILLA = [
  "Plantilla para subir anuncios en bloque a Meta (Facebook e Instagram)",
  "",
  `El archivo ${CSV_PLANTILLA} tiene las columnas que usa el Administrador de anuncios para importar anuncios en bloque,`,
  "con 6 filas de EJEMPLO (un producto inventado, 3 anuncios en Feed 4:5 y los mismos 3 en Stories y Reels 9:16).",
  "Ábrelo con Excel o Google Sheets y guárdalo otra vez como CSV.",
  "",
  ...PASOS_PLANTILLA.flatMap(([t, d], i) => [`${i + 1}) ${t}`, `   ${d}`]),
  "",
  "Columnas que más importan:",
  "- Campaign Name / Ad Set Name / Ad Name: los nombres. Filas con el mismo nombre de campaña quedan en la misma campaña.",
  "- Campaign Status / Ad Set Run Status / Ad Status: déjalos en PAUSED para revisar antes de gastar.",
  "- Title, Body, Link, Call to Action: el título, el texto, el link y el botón (SHOP_NOW, LEARN_MORE…).",
  "- Image File Name: el nombre EXACTO de la imagen que subiste (mayúsculas y extensión incluidas).",
  "- Ad Set Daily Budget, Link Object ID (tu página) e Instagram Account ID: complétalos tú o deja que Meta te los pida.",
  "",
  "Meta cambia sus columnas de vez en cuando: si te marca un error, descarga su plantilla oficial",
  "(Exportar e importar → Descargar plantilla) y copia ahí tus filas.",
  "",
  "En Creads, cada «Primera tanda» trae este archivo ya lleno con tus imágenes. Hecho con Creads IA · creadsia.com",
].join("\r\n");

export const csvPlantilla = () => csvMeta(TANDA_EJEMPLO, { pais: "CL" });

/** The ZIP the visitor downloads: the CSV with the example rows and the LEEME. */
export function zipPlantilla(): Uint8Array {
  return zipSync({ [CSV_PLANTILLA]: strToU8(csvPlantilla()), "LEEME.txt": strToU8(`﻿${LEEME_PLANTILLA}\r\n`) });
}

export { META_COLUMNS };
