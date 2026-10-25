import { fetchableUrl } from "./media";
import { readPrivateJSON, updatePrivateJSON } from "./supabase";
import { type Caso, esPublicable, inscribir } from "./caso-fundador";

// «Caso fundador» storage (server-only): one record per user, in the private bucket (casos-fundador.json,
// a map userId → Caso). Pure rules and texts in caso-fundador.ts.

const FILE = "casos-fundador.json";
type Casos = Record<string, Caso>;

export async function listarCasos(): Promise<Caso[]> {
  return Object.values((await readPrivateJSON<Casos>(FILE)) ?? {});
}

export async function casoDe(userId: string): Promise<Caso | null> {
  return ((await readPrivateJSON<Casos>(FILE)) ?? {})[userId] ?? null;
}

/** Changes one case under the file lock. `change` returns the new case, or null to leave it as it is. */
export async function cambiarCaso(userId: string, change: (cur: Caso | undefined) => Caso | null): Promise<Caso | null> {
  let out: Caso | null = null;
  await updatePrivateJSON<Casos>(FILE, (all) => {
    const cur = (all ?? {})[userId];
    const next = change(cur);
    if (!next) { out = cur ?? null; return undefined; }
    out = next;
    return { ...(all ?? {}), [userId]: next };
  });
  return out;
}

/** The checkbox was ticked at the Pack Prueba checkout. */
export const inscribirCaso = (o: { userId: string; ws: string; email: string; name: string | null; pedido: string }) =>
  cambiarCaso(o.userId, (cur) => inscribir(cur, o));

export interface TestimonioPublico { nombre: string; rubro: string; texto: string; imagen: string | null; beneficio: string | null }

/**
 * The testimonials the site may show: approved and published by the owner, with the checkout consent and the
 * explicit permission stored. The screenshot comes as a link valid for 7 days (pages using it must revalidate
 * at least that often). Empty list → the page hides the block.
 */
export async function testimoniosPublicados(): Promise<TestimonioPublico[]> {
  const casos = (await listarCasos().catch(() => [] as Caso[])).filter(esPublicable);
  casos.sort((a, b) => Date.parse(b.publicadoEn ?? "") - Date.parse(a.publicadoEn ?? ""));
  return Promise.all(casos.map(async (c) => ({
    nombre: c.testimonio!.nombre,
    rubro: c.testimonio!.rubro,
    texto: c.testimonio!.texto,
    imagen: c.testimonio!.imagen ? await fetchableUrl(c.testimonio!.imagen, c.ws, 7 * 86400).catch(() => null) : null,
    beneficio: c.beneficio?.trim() || null,
  })));
}
