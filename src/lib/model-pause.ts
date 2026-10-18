import { readPrivateJSON, writePrivateJSON } from "./supabase";

// Models the Guardián (or the owner) took out of the studio for a while because they're failing: customers
// don't see them and can't spend credits on them until the pause ends (by itself after a few hours, or
// when the owner turns them back on in Plataforma → Guardián).

export interface Pause { until: string; motivo: string; by: "guardian" | "dueño"; at: string }
const FILE = "modelos-pausados.json";
let cache: { at: number; v: Record<string, Pause> } | null = null;

/** The models paused right now (expired pauses don't count). Cached 30 s; never fails (no file = none). */
export async function pausedModels(fresh = false): Promise<Record<string, Pause>> {
  if (!fresh && cache && Date.now() - cache.at < 30_000) return cache.v;
  const all = (await readPrivateJSON<Record<string, Pause>>(FILE).catch(() => null)) ?? {};
  const now = new Date().toISOString();
  const v = Object.fromEntries(Object.entries(all).filter(([, p]) => p && p.until > now));
  cache = { at: Date.now(), v };
  return v;
}
export const isPaused = async (modelId: string) => Boolean((await pausedModels())[modelId]);

export async function pauseModel(modelId: string, hours: number, motivo: string, by: Pause["by"]) {
  const all = await pausedModels(true);
  all[modelId] = { until: new Date(Date.now() + hours * 3600_000).toISOString(), motivo: motivo.slice(0, 300), by, at: new Date().toISOString() };
  await writePrivateJSON(FILE, all);
  cache = null;
}
export async function unpauseModel(modelId: string) {
  const all = await pausedModels(true);
  delete all[modelId];
  await writePrivateJSON(FILE, all);
  cache = null;
}

export const PAUSED_TEXT = "Este modelo está en mantenimiento por unos minutos para que no pierdas créditos. Elige otro modelo o vuelve a intentar en un rato.";
