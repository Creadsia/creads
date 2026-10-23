// «Empezar de cero» (owner, 22 Oct 2026: «borrar todo y comenzar de cero para tener control desde ahora»).
// Nothing is deleted: the Panel's dashboards (campaigns, subscriptions, new accounts) just start counting from
// a moment the owner picks, and leave out the accounts he marks as tests. Undo = clear the date / unmark.

import { readPrivateJSON, updatePrivateJSON } from "./supabase";

const FILE = "panel/desde.json";
export interface Desde { desde: string | null; pruebas: string[] }

export async function panelDesde(): Promise<Desde> {
  const d = await readPrivateJSON<Desde>(FILE).catch(() => null);
  return { desde: typeof d?.desde === "string" && !Number.isNaN(Date.parse(d.desde)) ? d.desde : null, pruebas: Array.isArray(d?.pruebas) ? d.pruebas.filter((x) => typeof x === "string") : [] };
}
export async function setDesde(desde: string | null) {
  await updatePrivateJSON<Desde>(FILE, (cur) => ({ desde, pruebas: cur?.pruebas ?? [] }));
}
export async function setPrueba(ws: string, on: boolean) {
  if (!/^[a-z0-9][a-z0-9-]{2,40}$/.test(ws) || ws === "main") throw new Error("Cuenta no válida.");
  await updatePrivateJSON<Desde>(FILE, (cur) => {
    const set = new Set(cur?.pruebas ?? []);
    if (on) set.add(ws); else set.delete(ws);
    return { desde: cur?.desde ?? null, pruebas: [...set] };
  });
}
/** Whether a row (by its account and moment) counts in the dashboards. */
export const counts = (d: Desde, ws: string, iso: string | null | undefined) => !d.pruebas.includes(ws) && (!d.desde || (Boolean(iso) && iso! >= d.desde));
