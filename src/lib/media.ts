import { randomUUID } from "node:crypto";
import { sbHeaders } from "./supabase";

// Customers' files (faces, voices, products, generated videos) live in a PRIVATE bucket, one folder per
// workspace: vault/ws/<workspace>/<folder>/<file>. The app stores and passes around a "media link"
// (/api/media/ws/<workspace>/...), which only opens for a signed-in member of that workspace and
// redirects to a link that expires in minutes. Outside services (fal, Google, ElevenLabs) get their own
// short-lived link when a job starts.
//
// Files saved before this change sit in the old public bucket; they all belong to Creadsia ("main").

const VAULT = "vault";
const PREFIX = "/api/media/";
const WS = /^[a-z0-9][a-z0-9-]{2,40}$/;
const SAFE_PATH = /^ws\/[a-z0-9][a-z0-9-]{2,40}\/[a-z0-9/_.-]+$/i;

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.");
  return { url, key };
}

let vaultReady = false;
async function ensureVault() {
  if (vaultReady) return;
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/bucket`, {
    method: "POST",
    headers: { ...sbHeaders(key), "content-type": "application/json" },
    body: JSON.stringify({ id: VAULT, name: VAULT, public: false, file_size_limit: 52428800 }),
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    if (!/already exists|Duplicate/i.test(text)) throw new Error(`Storage: no se pudo crear el almacén privado (${res.status}).`);
  }
  vaultReady = true;
}

const pathFor = (ws: string, folder: string, name: string) => {
  if (!WS.test(ws)) throw new Error("Espacio de trabajo inválido.");
  const p = `ws/${ws}/${folder.replace(/[^a-z0-9/_-]/gi, "")}/${name.replace(/[^a-z0-9._-]/gi, "")}`;
  if (!SAFE_PATH.test(p) || p.includes("..")) throw new Error("Ruta de archivo inválida.");
  return p;
};
export const refFor = (path: string) => `${PREFIX}${path}`;

/** The storage path behind a media link, or null if it isn't one. */
export function pathOf(ref: string): string | null {
  if (!ref.startsWith(PREFIX)) return null;
  const p = ref.slice(PREFIX.length).split("?")[0];
  return SAFE_PATH.test(p) && !p.includes("..") ? p : null;
}

/** Workspace that owns a media link (null if it isn't a media link). */
export const workspaceOf = (ref: string) => pathOf(ref)?.split("/")[1] ?? null;

// Creadsia's own Higgsfield account (files made in the WinnerLab prototype).
const HIGGSFIELD = [
  "https://d2ol7oe51mr4n9.cloudfront.net/user_3DdKYHg29Dc6YLtguhB32IBiQZ7/",
  "https://d8j0ntlcm91z4.cloudfront.net/user_3DdKYHg29Dc6YLtguhB32IBiQZ7/",
];

/** Old links (public bucket, WinnerLab files): only Creadsia's own workspace may use them. */
function isLegacyPublic(ref: string) {
  if (ref.includes("..") || /[\s?#]/.test(ref)) return false;
  const base = process.env.SUPABASE_URL;
  if (base && ref.startsWith(`${base}/storage/v1/object/public/media/`)) return true;
  return HIGGSFIELD.some((p) => ref.startsWith(p) && /^[\w.-]+$/.test(ref.slice(p.length)));
}

/** True if this link points to a file of that workspace (the only files a customer may use). */
export function ownsMedia(ref: unknown, ws: string): ref is string {
  if (typeof ref !== "string" || ref.length > 600) return false;
  if (workspaceOf(ref) === ws) return true;
  return ws === "main" && isLegacyPublic(ref);
}

/** Saves bytes in the workspace's private folder and returns the media link. */
export async function saveMedia(ws: string, folder: string, body: ArrayBuffer | Uint8Array, contentType: string, name?: string) {
  await ensureVault();
  const ext = (contentType.split("/")[1] || "bin").replace("jpeg", "jpg").replace("mpeg", "mp3").replace("quicktime", "mov").replace("plain", "txt").replace(/[^a-z0-9]/g, "");
  const path = pathFor(ws, folder, name ?? `${randomUUID()}.${ext}`);
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/object/${VAULT}/${path}`, {
    method: "POST",
    headers: { ...sbHeaders(key), "content-type": contentType, "x-upsert": "true" },
    body: body as BodyInit,
  });
  if (!res.ok) throw new Error(`Storage: no se pudo guardar el archivo (${res.status}).`);
  return refFor(path);
}

/** True if a file is already saved under that name (so a finished video is copied only once). */
export async function mediaSaved(ws: string, folder: string, name: string) {
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/object/info/${VAULT}/${pathFor(ws, folder, name)}`, { headers: sbHeaders(key), cache: "no-store" });
  return res.ok;
}
export const mediaRefOf = (ws: string, folder: string, name: string) => refFor(pathFor(ws, folder, name));

/**
 * A link outside services (and our own server) can download from, valid for `seconds`.
 * Refuses files of another workspace.
 */
export async function fetchableUrl(ref: string, ws: string, seconds = 3 * 3600) {
  if (!ownsMedia(ref, ws)) throw new Error("Ese archivo no es de tu cuenta.");
  const path = pathOf(ref);
  if (!path) return ref; // legacy public link (Creadsia only)
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/object/sign/${VAULT}/${path}`, {
    method: "POST",
    headers: { ...sbHeaders(key), "content-type": "application/json" },
    body: JSON.stringify({ expiresIn: seconds }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Storage: no se pudo abrir el archivo (${res.status}).`);
  const data = await res.json();
  const signed: string | undefined = data?.signedURL ?? data?.signedUrl;
  if (!signed) throw new Error("Storage: respuesta inesperada al firmar el archivo.");
  return `${url}/storage/v1${signed.startsWith("/") ? signed : `/${signed}`}`;
}

/** One-time direct upload from the browser into the workspace's private folder (videos up to 50 MB). */
export async function signedUploadFor(ws: string, folder: string, ext: string) {
  await ensureVault();
  const path = pathFor(ws, folder, `${randomUUID()}.${ext}`);
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/object/upload/sign/${VAULT}/${path}`, {
    method: "POST",
    headers: { ...sbHeaders(key), "content-type": "application/json" },
    body: "{}",
  });
  if (!res.ok) throw new Error(`Storage: no se pudo preparar la subida (${res.status}).`);
  const data = await res.json();
  if (typeof data?.url !== "string") throw new Error("Storage: respuesta inesperada al preparar la subida.");
  return { uploadUrl: `${url}/storage/v1${data.url}`, publicUrl: refFor(path) };
}

/**
 * Copies a file from one workspace into another one's private folder (used when a customer recreates
 * an example video Creadsia published: from then on it is their own file, like any upload).
 */
export async function copyMedia(ref: string, toWs: string, folder: string) {
  await ensureVault();
  const from = pathOf(ref);
  if (!from) throw new Error("Archivo inválido.");
  const ext = from.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "mp4";
  const to = pathFor(toWs, folder, `${randomUUID()}.${ext}`);
  const { url, key } = env();
  const res = await fetch(`${url}/storage/v1/object/copy`, {
    method: "POST",
    headers: { ...sbHeaders(key), "content-type": "application/json" },
    body: JSON.stringify({ bucketId: VAULT, sourceKey: from, destinationKey: to }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Storage: no se pudo copiar el archivo (${res.status}).`);
  return refFor(to);
}
