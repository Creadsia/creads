// «Mirando ahora» (owner, 22 Oct 2026): how many people have Creads open right now, and on which page.
// Every open tab sends a beat every 20 s while it's visible; a beat is a row in rate_limits (same table as
// the rate limits, key «live:<tab>:<page>», no new table needed). Anonymous: a random id per browser tab,
// no IP, no cookie, no account.

import { sbRest, sbRpc } from "./supabase";

export const PAGES: Record<string, string> = {
  inicio: "Inicio", empezar: "Elegir plan y pagar", planes: "Planes (dentro)", automatico: "Automático", crear: "Crear (Manual)",
  terminados: "Anuncios terminados", estudio: "Otras partes del estudio", otra: "Otras páginas",
};

/** The page a path belongs to (a short fixed list, so keys stay clean). */
export function pageOf(path: string): string {
  const p = String(path || "/").split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (p === "/" || p === "/es") return "inicio";
  if (p === "/empezar") return "empezar";
  if (p === "/app/planes") return "planes";
  if (p.startsWith("/app/automatico")) return "automatico";
  if (p.startsWith("/app/crear")) return "crear";
  if (p.startsWith("/app/biblioteca")) return "terminados";
  if (p.startsWith("/app")) return "estudio";
  return "otra";
}

export const TAB = /^[a-z0-9]{8,24}$/;

export async function beat(tab: string, page: string) {
  await sbRpc("hit_rate", { p_key: `live:${tab}:${page}`, p_window: 20, p_max: 1_000_000 });
}

/** People active in the last ~minute: each tab once (its latest page). */
export function summarize(rows: { key: string; window_start: string }[], now = Date.now()) {
  const latest = new Map<string, { page: string; at: number }>();
  for (const r of rows) {
    const [, tab, page] = r.key.split(":");
    const at = Date.parse(r.window_start);
    if (!tab || !page || !(now - at < 60_000)) continue;
    const cur = latest.get(tab);
    if (!cur || at > cur.at) latest.set(tab, { page, at });
  }
  const byPage: Record<string, number> = {};
  for (const { page } of latest.values()) byPage[page] = (byPage[page] ?? 0) + 1;
  return { total: latest.size, byPage };
}

export async function liveNow() {
  const since = new Date(Date.now() - 60_000).toISOString();
  const rows = await sbRest<{ key: string; window_start: string }[]>(`rate_limits?key=like.live%3A*&window_start=gte.${encodeURIComponent(since)}&select=key,window_start&limit=5000`);
  return summarize(rows ?? []);
}
