// Server-only helpers for Supabase (database REST + storage). The service key never reaches the browser.

const BUCKET = "media";

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

let bucketReady = false;

/** Creates the public `media` bucket the first time it is needed. */
async function ensureBucket() {
  if (bucketReady) return;
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...sbHeaders(key), "content-type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: 52428800 }),
  });
  // 409 / "already exists" is fine.
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    if (!/already exists|Duplicate/i.test(text)) throw new Error(`Storage: no se pudo crear el bucket (${res.status}).`);
  }
  bucketReady = true;
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
