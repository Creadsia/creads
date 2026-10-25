import { unstable_cache } from "next/cache";
import { countRows, listPrivateFiles, readPrivateJSON, sbAll, updatePrivateJSON } from "./supabase";
import { panelDesde } from "./panel-desde";
import {
  type ContadoresCrudos,
  type Contador,
  type EntradaRoadmap,
  type GaleriaItem,
  type GaleriaPublicaItem,
  type Lista,
  type Novedad,
  contadoresVisibles,
  itemPublico,
  marcasActivas,
  ordenarEntradas,
} from "./confianza";

// Server side of the home page «confianza» blocks (pure rules in ./confianza.ts). Every public function here
// returns an empty value instead of failing: a block with no real data hides itself, never shows filler.

const FILE = "portada/confianza.json";
export const TAG_PORTADA = "portada";
export const TAG_CONTADORES = "contadores";

export interface Portada { galeria: GaleriaItem[]; novedades: Novedad[]; roadmap: EntradaRoadmap[] }
const VACIA: Portada = { galeria: [], novedades: [], roadmap: [] };
const norm = (p: Partial<Portada> | null): Portada => ({
  galeria: Array.isArray(p?.galeria) ? p.galeria : [],
  novedades: Array.isArray(p?.novedades) ? p.novedades : [],
  roadmap: Array.isArray(p?.roadmap) ? p.roadmap : [],
});

/** The admin's content, straight from storage (admin panel). */
export async function leerPortada(): Promise<Portada> {
  return norm(await readPrivateJSON<Partial<Portada>>(FILE));
}

// public pages and the gallery file route read it through a 5-minute cache, cleared on every admin change
const portadaCache = unstable_cache(leerPortada, ["portada-confianza"], { revalidate: 300, tags: [TAG_PORTADA] });
async function portadaPublica(): Promise<Portada> {
  try { return await portadaCache(); } catch { return VACIA; }
}

/** Read → change → write the admin's content (with the shared-file lock). */
export async function cambiarPortada(fn: (p: Portada) => Portada): Promise<Portada> {
  return (await updatePrivateJSON<Partial<Portada>>(FILE, (cur) => fn(norm(cur)))) as Portada;
}

/** Gallery «Hecho con Creads» for the home page, in the admin's order. [] = hide the block. */
export async function galeriaPublica(): Promise<GaleriaPublicaItem[]> {
  return (await portadaPublica()).galeria.map(itemPublico);
}

/** The private file behind a public gallery id (only listed items; `poster` = its still image). */
export async function archivoGaleria(id: string, poster = false): Promise<string | null> {
  const it = (await portadaPublica()).galeria.find((i) => i.id === id);
  return (poster ? it?.poster : it?.ref) ?? null;
}

/** Latest changelog entries, newest first. [] = nothing to show. */
export async function novedadesRecientes(n = 3): Promise<Novedad[]> {
  return ordenarEntradas((await portadaPublica()).novedades).slice(0, Math.max(0, n));
}
export async function todasLasNovedades(): Promise<Novedad[]> {
  return ordenarEntradas((await portadaPublica()).novedades);
}
export async function roadmapPublico(): Promise<EntradaRoadmap[]> {
  return ordenarEntradas((await portadaPublica()).roadmap);
}
export const tieneEntradas = async (l: Lista) => (await portadaPublica())[l].length > 0;

// ---------- real counters ----------

/**
 * Real totals from the database. «Anuncios»: images produced (table images; the «gen:image» clips are the same
 * images, so they are not added again) + finished video ads (ads with their final file) + standalone AI videos
 * finished («gen:video» clips). «Marcas»: brand kits whose account produced something in the last 30 days (or
 * saved the kit then). Test accounts are left out; Creadsia's own account is left out of «marcas».
 */
export async function contarCrudo(now = Date.now()): Promise<ContadoresCrudos> {
  const { pruebas } = await panelDesde();
  const notTest = pruebas.length ? `owner=not.in.(${pruebas.map((w) => `"${w}"`).join(",")})&` : "";
  const since = new Date(now - 30 * 86_400_000).toISOString();
  const [imagenes, anuncios, videos, kits, clipOwners, imgOwners] = await Promise.all([
    countRows("images", notTest.slice(0, -1)),
    countRows("ads", `${notTest}final_url=not.is.null`),
    countRows("clips", `${notTest}kind=eq.gen:video&status=eq.done`),
    listPrivateFiles("marca"),
    sbAll<{ owner: string }>(`clips?status=eq.done&created_at=gte.${since}&select=owner`, "created_at.asc,id.asc"),
    sbAll<{ owner: string }>(`images?created_at=gte.${since}&select=owner`, "created_at.asc,id.asc"),
  ]);
  const activos = new Set([...clipOwners, ...imgOwners].map((r) => r.owner));
  return { anuncios: imagenes + anuncios + videos, marcas: marcasActivas(kits, activos, since, pruebas), actualizado: new Date(now).toISOString() };
}

const contadoresCache = unstable_cache(() => contarCrudo(), ["contadores-reales"], { revalidate: 3600, tags: [TAG_CONTADORES] });

/** Counters for the home page, only those above their threshold (CONTADOR_MIN_*). [] = hide the block. */
export async function contadoresReales(): Promise<Contador[]> {
  try {
    return contadoresVisibles(await contadoresCache(), process.env);
  } catch {
    return [];
  }
}
