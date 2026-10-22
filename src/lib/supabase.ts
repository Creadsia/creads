// Server-only helpers for Supabase (database REST + storage). The service key never reaches the browser.

const BUCKET = "media"; // public: generated images and videos
const PRIVATE = "admin"; // private: the owner's internal files (finance book)

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.");
  return { url, key };
}

/** Auth headers. Legacy service_role keys are JWTs and also go in Authorization; new sb_secret_ keys only need apikey. */
export function sbHeaders(key: string): Record<string, string> {
  return { apikey: key, ...(key.startsWith("eyJ") ? { authorization: `Bearer ${key}` } : {}) };
}

const ready = new Set<string>();

/** Creates a storage bucket the first time it is needed. */
async function ensureBucket(id = BUCKET, isPublic = true) {
  if (ready.has(id)) return;
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...sbHeaders(key), "content-type": "application/json" },
    body: JSON.stringify({ id, name: id, public: isPublic, file_size_limit: 52428800 }),
  });
  // 409 / "already exists" is fine.
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    if (!/already exists|Duplicate/i.test(text)) throw new Error(`Storage: no se pudo crear el bucket (${res.status}).`);
  }
  ready.add(id);
}

export function publicUrl(path: string) {
  return `${env().url}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** Uploads bytes to storage and returns their public URL. Paths use random ids, so links are unguessable. */
export async function uploadMedia(path: string, body: ArrayBuffer | Uint8Array, contentType: string) {
  await ensureBucket();
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: { ...sbHeaders(key), "content-type": contentType, "x-upsert": "true" },
    body: body as BodyInit,
  });
  if (!res.ok) throw new Error(`Storage: no se pudo guardar el archivo (${res.status}).`);
  return publicUrl(path);
}

/** True if a file already exists at that path (used so a finished video is copied only once). */
export async function mediaExists(path: string) {
  const res = await fetch(publicUrl(path), { method: "HEAD" });
  return res.ok;
}

/** Reads a JSON file from the private bucket; null if it doesn't exist yet. */
export async function readPrivateJSON<T>(path: string): Promise<T | null> {
  await ensureBucket(PRIVATE, false);
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/object/${PRIVATE}/${path}`, { headers: sbHeaders(key), cache: "no-store" });
  if (res.status === 404) return null;
  // Storage answers a missing file with 400 + {"statusCode":"404","error":"not_found"}; any other 400
  // (bad key, bad path) is an error, so callers never mistake it for "empty" and overwrite the file.
  if (res.status === 400) {
    const body = await res.text().catch(() => "");
    if (/not.?found|"404"/i.test(body)) return null;
    throw new Error(`Storage: no se pudo leer ${path} (400).`);
  }
  if (!res.ok) throw new Error(`Storage: no se pudo leer ${path} (${res.status}).`);
  return (await res.json()) as T;
}

/** Writes a JSON file to the private bucket (replacing it). */
export async function writePrivateJSON(path: string, data: unknown) {
  await ensureBucket(PRIVATE, false);
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/object/${PRIVATE}/${path}`, {
    method: "POST",
    headers: { ...sbHeaders(key), "content-type": "application/json", "x-upsert": "true", "cache-control": "no-cache" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Storage: no se pudo guardar ${path} (${res.status}).`);
}

/** Rows from a database table through the REST API (server only). */
export async function selectRows<T>(table: string, query: string): Promise<T[]> {
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/${table}?${query}`, { headers: sbHeaders(key), cache: "no-store" });
  if (!res.ok) throw new Error(`Base de datos: no se pudo leer ${table} (${res.status}).`);
  return (await res.json()) as T[];
}

/** The public link prefix of our media bucket; tool inputs must start with it (no outside links). */
export const mediaPrefix = () => publicUrl("");
export const isOurMedia = (u: unknown): u is string => typeof u === "string" && u.startsWith(mediaPrefix()) && !u.includes("..");

/**
 * A one-time link that lets the browser upload one file straight to storage (for videos over the
 * 4 MB a server request allows). Returns the URL to PUT to and the file's public link.
 */
export async function signedUpload(path: string) {
  await ensureBucket();
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/object/upload/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers: { ...sbHeaders(key), "content-type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`Storage: no se pudo preparar la subida (${res.status}).`);
  const data = await res.json();
  if (typeof data?.url !== "string") throw new Error("Storage: respuesta inesperada al preparar la subida.");
  return { uploadUrl: `${url}/storage/v1${data.url}`, publicUrl: publicUrl(path) };
}

/** Error from the database REST API; `missing` = the table or function isn't created yet. */
export class SbError extends Error {
  constructor(msg: string, public status: number, public missing: boolean) {
    super(msg);
  }
}

/** Calls the database REST API with the service key (server only, trusted callers only). */
export async function sbRest<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...sbHeaders(key), "content-type": "application/json", prefer: "return=representation", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const missing = res.status === 404 || ["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(body?.code);
    throw new SbError(`Base de datos: ${body?.message ?? res.statusText}`, res.status, missing);
  }
  return body as T;
}

/** Runs a database function (security definer, service role only). */
export const sbRpc = <T = unknown>(fn: string, args: Record<string, unknown>) =>
  sbRest<T>(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) });

/** All rows of a PostgREST query, 1000 at a time (the database hands out at most 1000 per request).
 *  `order` must be unique (add a tie-breaker like `,id.asc`) so pages don't repeat or skip rows.
 *  Fails instead of returning a cut list when there are more than `maxPages` pages. */
export async function sbAll<T>(q: string, order = "created_at.asc", maxPages = 50): Promise<T[]> {
  const out: T[] = [];
  for (let p = 0; p < maxPages; p++) {
    const page = await sbRest<T[]>(`${q}&order=${order}&limit=1000&offset=${p * 1000}`);
    out.push(...page);
    if (page.length < 1000) return out;
  }
  throw new Error(`Demasiadas filas (más de ${maxPages * 1000}).`);
}

// ---------- shared files that many requests update at once ----------
// Private JSON files (logs, lists) are read, changed and written back. Two requests doing that at the same
// moment would lose one change, so the update holds a short lock first: a row in rate_limits (the same atomic
// counter as the rate limits), released right after; if a request dies holding it, it frees itself in 15 s.

const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs `fn` while holding the lock `name` (waits up to `waitMs` for it; after that runs anyway, best effort). */
export async function withLock<T>(name: string, fn: () => Promise<T>, waitMs = 8000): Promise<T> {
  const key = `lock:${name}`.slice(0, 200);
  const t0 = Date.now();
  let held = false;
  while (!held) {
    held = await sbRpc<boolean>("hit_rate", { p_key: key, p_window: 15, p_max: 1 }).then(Boolean).catch(() => true);
    if (held || Date.now() - t0 > waitMs) break;
    await sleepMs(120 + Math.random() * 180);
  }
  try {
    return await fn();
  } finally {
    if (held) await sbRest(`rate_limits?key=eq.${encodeURIComponent(key)}`, { method: "DELETE", headers: { prefer: "return=minimal" } }).catch(() => {});
  }
}

/** Read → change → write a private JSON file without losing a change made by another request at the same time. */
export async function updatePrivateJSON<T>(path: string, change: (current: T | null) => T | undefined): Promise<T | undefined> {
  return withLock(`file:${path}`, async () => {
    const next = change(await readPrivateJSON<T>(path));
    if (next !== undefined) await writePrivateJSON(path, next);
    return next;
  });
}
