import { sbHeaders } from "./supabase";

// The only door to the studio tables. Nothing here is usable without saying which workspace
// (customer) is acting: `dbFor(user.workspace)`. Learned rules are shared by everyone: `sharedRules`.
//
// Two ways in, same rules:
// - With DATABASE_URL (the app's own database role, see supabase/tenancy.sql) every request runs in a
//   transaction that tells Postgres the workspace; Row Level Security then hides every other customer's
//   rows even if this code had a bug.
// - Without it (until the owner sets it up) the REST API is used with the service key and an explicit
//   owner filter on every call.

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
export type TenantTable = Exclude<Table, "rules">;
export const isTable = (t: string): t is Table => Object.prototype.hasOwnProperty.call(TABLES, t);

const JSONB: Partial<Record<Table, string[]>> = { scripts: ["cuts"], ads: ["settings"] };
const SYSTEM_COLS = ["id", "owner", "created_at", "updated_at"];
const colOk = (table: Table, c: string) => SYSTEM_COLS.includes(c) || (TABLES[table] as readonly string[]).includes(c);

export class DbError extends Error {
  constructor(message: string, public status: number, public missingTable = false) { super(message); }
}

type Row = Record<string, unknown>;

/** Keeps only the writable columns of a table. */
export function clean(table: Table, data: Row) {
  const allowed = TABLES[table] as readonly string[];
  return Object.fromEntries(Object.entries(data).filter(([k]) => allowed.includes(k)));
}

export const WORKSPACE_RE = /^[a-z0-9][a-z0-9-]{2,40}$/;

// ---------- filters ----------
// Callers describe filters in the REST style the app already used ("ad_id=eq.X&order=idx.asc&limit=5").
// The same string works for both ways in; on the SQL side it's parsed and every value becomes a parameter.

export interface Filter { where: { col: string; op: "eq" | "like"; val: string }[]; any: { col: string; op: "eq" | "like"; val: string }[]; order?: { col: string; desc: boolean }; limit?: number }

export function parseFilter(table: Table, query: string): Filter {
  const f: Filter = { where: [], any: [] };
  for (const part of query.split("&").filter(Boolean)) {
    const i = part.indexOf("=");
    const key = part.slice(0, i);
    const raw = decodeURIComponent(part.slice(i + 1));
    if (key === "select") continue;
    if (key === "order") {
      const [col, dir] = raw.split(".");
      if (!colOk(table, col)) throw new DbError(`Columna desconocida: ${col}`, 400);
      f.order = { col, desc: dir === "desc" };
    } else if (key === "limit") {
      f.limit = Math.max(1, Math.min(1000, Number(raw) || 100));
    } else if (key === "or") {
      // or=(kind.like.tool:*,kind.like.gen:*)
      for (const term of raw.replace(/^\(|\)$/g, "").split(",")) {
        const [col, op, ...v] = term.split(".");
        if (!colOk(table, col) || (op !== "eq" && op !== "like")) throw new DbError("Filtro inválido.", 400);
        f.any.push({ col, op, val: v.join(".") });
      }
    } else {
      const [op, ...v] = raw.split(".");
      if (!colOk(table, key) || (op !== "eq" && op !== "like")) throw new DbError(`Filtro inválido: ${key}`, 400);
      f.where.push({ col: key, op, val: v.join(".") });
    }
  }
  return f;
}

function toSql(f: Filter, params: unknown[]) {
  const cond = (w: Filter["where"][number]) => {
    params.push(w.op === "like" ? w.val.replace(/\*/g, "%") : w.val);
    return w.op === "like" ? `"${w.col}"::text like $${params.length}` : `"${w.col}" = $${params.length}`;
  };
  const parts = f.where.map(cond);
  if (f.any.length) parts.push(`(${f.any.map(cond).join(" or ")})`);
  return {
    where: parts.length ? ` where ${parts.join(" and ")}` : "",
    tail: `${f.order ? ` order by "${f.order.col}" ${f.order.desc ? "desc" : "asc"}` : ""}${f.limit ? ` limit ${f.limit}` : ""}`,
  };
}

// ---------- SQL way in (Row Level Security) ----------

/** Runs SQL acting for a workspace (null = no workspace: only shared tables are visible). */
export type Exec = (workspace: string | null, sql: string, params: unknown[]) => Promise<Row[]>;

let customExec: Exec | null = null;
/** Tests plug an in-memory Postgres here. */
export function setExecutor(exec: Exec | null) { customExec = exec; }

let pool: import("pg").Pool | null = null;
let checkedRole = false;

async function pgExec(workspace: string | null, sql: string, params: unknown[]): Promise<Row[]> {
  if (!pool) {
    const pg = await import("pg");
    // numbers as numbers, times as ISO strings (the same shapes the REST API returned)
    pg.types.setTypeParser(1700, (v: string) => Number(v));
    pg.types.setTypeParser(1184, (v: string) => new Date(v).toISOString());
    pg.types.setTypeParser(1114, (v: string) => new Date(`${v}Z`).toISOString());
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 10_000, ssl: { rejectUnauthorized: false } });
  }
  const client = await pool.connect();
  try {
    if (!checkedRole) {
      // Refuse to run as a role that could skip the rules (e.g. if someone pasted the main database user).
      const r = await client.query("select current_user as u, (select rolbypassrls from pg_roles where rolname = current_user) as bypass");
      if (r.rows[0]?.u !== "creads_app" || r.rows[0]?.bypass) throw new DbError("DATABASE_URL debe usar el usuario creads_app.", 500);
      checkedRole = true;
    }
    await client.query("begin");
    await client.query("select set_config('app.workspace', $1, true)", [workspace ?? ""]);
    const res = await client.query(sql, params);
    await client.query("commit");
    return res.rows;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    const e = err as { code?: string; message?: string };
    if (e.code === "42P01") throw new DbError("Faltan las tablas de la plataforma en Supabase (hay que ejecutar el SQL).", 503, true);
    if (err instanceof DbError) throw err;
    throw new DbError(`Base de datos: ${e.message ?? "error"}`, 502);
  } finally {
    client.release();
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const exec: Exec = (ws, sql, params) => (customExec ?? pgExec)(ws, sql, params);
const sqlMode = () => Boolean(customExec || process.env.DATABASE_URL);

function sqlDb(ws: string | null) {
  const q = (sql: string, params: unknown[] = []) => exec(ws, sql, params);
  const values = (table: Table, data: Row, params: unknown[]) =>
    Object.entries(data).map(([k, v]) => {
      const json = JSONB[table]?.includes(k);
      params.push(json ? JSON.stringify(v ?? null) : v);
      return `$${params.length}${json ? "::jsonb" : ""}`;
    });
  return {
    list: async (table: Table, query = "order=created_at.desc&limit=500") => {
      const params: unknown[] = [];
      const { where, tail } = toSql(parseFilter(table, query), params);
      return q(`select * from public."${table}"${where}${tail}`, params);
    },
    get: async (table: Table, id: string) => (UUID.test(id) ? (await q(`select * from public."${table}" where id = $1 limit 1`, [id]))[0] ?? null : null),
    insert: async (table: Table, data: Row, owner?: string) => {
      const d = { ...clean(table, data), ...(owner ? { owner } : {}) };
      const params: unknown[] = [];
      const vals = values(table, d, params);
      const cols = Object.keys(d).map((c) => `"${c}"`);
      return (await q(`insert into public."${table}" (${cols.join(", ")}) values (${vals.join(", ")}) returning *`, params))[0];
    },
    update: async (table: Table, id: string, data: Row) => {
      if (!UUID.test(id)) return undefined;
      const d = clean(table, data);
      const params: unknown[] = [];
      const vals = values(table, d, params);
      const sets = Object.keys(d).map((c, i) => `"${c}" = ${vals[i]}`);
      params.push(id);
      return (await q(`update public."${table}" set ${[...sets, "updated_at = now()"].join(", ")} where id = $${params.length} returning *`, params))[0];
    },
    remove: async (table: Table, id: string) => { if (UUID.test(id)) await q(`delete from public."${table}" where id = $1`, [id]); },
    count: async (table: Table) => Number((await q(`select count(*)::int as n from public."${table}"`))[0]?.n ?? 0),
  };
}

// ---------- REST way in (service key + explicit owner filter) ----------

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.");
  return { url, key };
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
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function restDb(owner: string | null) {
  // shared tables (rules) are read without an owner filter
  const scope = owner ? `owner=eq.${owner}&` : "";
  return {
    list: (table: Table, query = "order=created_at.desc&limit=500") => {
      parseFilter(table, query); // same validation as the SQL way
      return call(`${table}?${scope}${query}`) as Promise<Row[]>;
    },
    get: async (table: Table, id: string) => ((await call(`${table}?${scope}id=eq.${encodeURIComponent(id)}&limit=1`)) as Row[])[0] ?? null,
    insert: async (table: Table, data: Row, ownerOverride?: string) =>
      ((await call(table, { method: "POST", body: JSON.stringify({ ...clean(table, data), owner: ownerOverride ?? owner ?? "main" }) })) as Row[])[0],
    update: async (table: Table, id: string, data: Row) =>
      ((await call(`${table}?${scope}id=eq.${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ ...clean(table, data), updated_at: new Date().toISOString() }) })) as Row[])[0],
    remove: async (table: Table, id: string) => { await call(`${table}?${scope}id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { prefer: "return=minimal" } }); },
    count: async (table: Table) => {
      const { url, key } = env();
      const res = await fetch(`${url}/rest/v1/${table}?${scope}select=id&limit=1`, { headers: { ...sbHeaders(key), prefer: "count=exact" }, cache: "no-store" });
      if (!res.ok) throw new DbError("No se pudo contar.", res.status, res.status === 404);
      return Number((res.headers.get("content-range") ?? "").split("/")[1] ?? 0) || 0;
    },
  };
}

// ---------- public API ----------

/** The studio tables as seen by one workspace. Rules (shared) are not reachable from here. */
export function dbFor(workspace: string) {
  if (!WORKSPACE_RE.test(workspace)) throw new DbError("Espacio de trabajo inválido.", 400);
  const inner = sqlMode() ? sqlDb(workspace) : restDb(workspace);
  const guard = (t: Table): TenantTable => {
    if (t === "rules") throw new DbError("Las reglas aprendidas se leen con sharedRules.", 400);
    return t;
  };
  return {
    workspace,
    list: (t: TenantTable, query?: string) => inner.list(guard(t), query),
    get: (t: TenantTable, id: string) => inner.get(guard(t), id),
    insert: (t: TenantTable, data: Row) => inner.insert(guard(t), data),
    update: (t: TenantTable, id: string, data: Row) => inner.update(guard(t), id, data),
    remove: (t: TenantTable, id: string) => inner.remove(guard(t), id),
    count: (t: TenantTable) => inner.count(guard(t)),
  };
}
export type Db = ReturnType<typeof dbFor>;

/**
 * Learned rules: one list shared by every customer (failures and fixes improve prompts for all).
 * Anyone may read; the app adds and updates them; only Creadsia (workspace "main") turns them off.
 */
export const sharedRules = {
  list: (query = "order=hits.desc&limit=60") => (sqlMode() ? sqlDb(null) : restDb(null)).list("rules", query),
  add: (data: Row) => (sqlMode() ? sqlDb(null) : restDb(null)).insert("rules", data, "main"),
  update: (id: string, data: Row) => (sqlMode() ? sqlDb(null) : restDb(null)).update("rules", id, data),
};
