import { sbHeaders } from "./supabase";

// Minimal server-side access to the platform tables through Supabase's REST API (service key).
// Every row carries `owner`; until accounts exist (Phase 2) everything belongs to "main".

export const OWNER = "main";

/** Tables the app may touch, and the columns a client may write in each. */
export const TABLES = {
  avatars: ["name", "description", "image_url", "voice_id", "voice_name", "lang", "consent", "notes"],
  products: ["name", "description", "image_url", "notes"],
  scripts: ["title", "lang", "format", "text", "cuts", "favorite", "notes"],
  ads: ["title", "script_id", "format", "aspect", "model", "status", "settings", "final_url", "favorite"],
  clips: ["ad_id", "idx", "kind", "text", "prompt", "model", "provider_job", "status", "url", "image_url", "error", "usd"],
  images: ["prompt", "url", "model", "aspect", "favorite"],
  rules: ["rule_en", "rule_es", "formats", "hits", "active"],
} as const;
export type Table = keyof typeof TABLES;
export const isTable = (t: string): t is Table => Object.prototype.hasOwnProperty.call(TABLES, t);

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.");
  return { url, key };
}

export class DbError extends Error {
  constructor(message: string, public status: number, public missingTable = false) { super(message); }
}

async function call(path: string, init: RequestInit = {}) {
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...sbHeaders(key), "content-type": "application/json", prefer: "return=representation", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const missing = res.status === 404 || body?.code === "42P01" || body?.code === "PGRST205";
    throw new DbError(missing ? "Faltan las tablas de la plataforma en Supabase (hay que ejecutar el SQL)." : `Base de datos: ${body?.message ?? res.statusText}`, res.status, missing);
  }
  return res.status === 204 ? null : res.json();
}

/** Keeps only the writable columns of a table. */
export function clean(table: Table, data: Record<string, unknown>) {
  const allowed = TABLES[table] as readonly string[];
  return Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
}

export const db = {
  list: (table: Table, query = "order=created_at.desc&limit=500") =>
    call(`${table}?owner=eq.${OWNER}&${query}`) as Promise<Record<string, unknown>[]>,
  get: async (table: Table, id: string) => ((await call(`${table}?owner=eq.${OWNER}&id=eq.${encodeURIComponent(id)}&limit=1`)) as Record<string, unknown>[])[0] ?? null,
  insert: async (table: Table, data: Record<string, unknown>) =>
    ((await call(table, { method: "POST", body: JSON.stringify({ ...clean(table, data), owner: OWNER }) })) as Record<string, unknown>[])[0],
  update: async (table: Table, id: string, data: Record<string, unknown>) =>
    ((await call(`${table}?owner=eq.${OWNER}&id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ ...clean(table, data), updated_at: new Date().toISOString() }) })) as Record<string, unknown>[])[0],
  remove: (table: Table, id: string) => call(`${table}?owner=eq.${OWNER}&id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { prefer: "return=minimal" } }),
  count: async (table: Table, filter = "") => {
    const { url, key } = env();
    const res = await fetch(`${url}/rest/v1/${table}?owner=eq.${OWNER}${filter ? `&${filter}` : ""}&select=id&limit=1`, {
      headers: { ...sbHeaders(key), prefer: "count=exact" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const range = res.headers.get("content-range") ?? "";
    return Number(range.split("/")[1] ?? 0) || 0;
  },
};
