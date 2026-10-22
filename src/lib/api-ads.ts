import { readPrivateJSON, writePrivateJSON } from "./supabase";
import { SITE } from "./emails";
import { FORMATS, SOLD_FORMATS } from "./formats";
import { videoProviders } from "./providers";
import { type AdJob, type Studio, runStep } from "./ad-runner";
import { once } from "./marketing";
import { pickModel } from "./autoprod";

// «Hazme un anuncio» for the public API (and any system with an API key): a script in, a finished video out,
// made by the same pipeline as «Crear anuncio» and charged to the key's account. Each job is a small private
// file; it advances one step every time its status is asked (GET /api/v1/anuncios/{id}), so the caller's
// polling drives it and no other process is needed.

export interface ApiAd extends AdJob { id: string; ws: string; userId: string; createdAt: string; sello: boolean; checkedAt?: string }

const file = (ws: string, id: string) => `api/anuncios/${ws}/${id}.json`;
const indexFile = (ws: string) => `api/anuncios/${ws}/index.json`;
const DONE = new Set(["listo", "error"]);

/** Formats the API makes: the ones where people talk on camera (narrated formats need a voice choice). */
export const API_FORMATS = FORMATS.filter((f) => !f.narr && SOLD_FORMATS.includes(f.id)).map((f) => f.id);

export function readOrder(b: Record<string, unknown>): { guion: string; formato: string; idioma: "es-CL" | "en"; modelo?: string; titulo: string; sello: boolean; avatarId?: string; edicion: "pro" | "simple"; indicaciones?: string; look?: { plantilla?: string; c1?: string; c2?: string }; subtitulos?: boolean } | string {
  const guion = typeof b.guion === "string" ? b.guion.trim() : "";
  if (guion.length < 20) return "Manda el guion en «guion» (al menos 20 caracteres).";
  if (guion.length > 4000) return "El guion es muy largo (máximo 4.000 caracteres).";
  const formato = typeof b.formato === "string" ? b.formato : "ugc";
  if (!API_FORMATS.includes(formato as (typeof API_FORMATS)[number])) return `Formato no disponible por API. Usa uno de: ${API_FORMATS.join(", ")}.`;
  const idioma = b.idioma === "en" ? "en" : "es-CL";
  let modelo: string | undefined;
  if (b.modelo !== undefined && b.modelo !== null && b.modelo !== "") {
    const p = videoProviders.find((x) => x.id === b.modelo && x.configured() && !x.silent && (!x.needsImage || Boolean(x.talking)));
    if (!p) return `Modelo no disponible. Usa uno de: ${videoProviders.filter((x) => x.configured() && !x.silent && (!x.needsImage || Boolean(x.talking))).map((x) => x.id).join(", ")}.`;
    modelo = p.id;
  }
  const titulo = (typeof b.titulo === "string" && b.titulo.trim() ? b.titulo.trim() : guion.split(/[.!?\n]/)[0]).slice(0, 80);
  let avatarId: string | undefined;
  if (b.avatar !== undefined && b.avatar !== null && b.avatar !== "") {
    if (typeof b.avatar !== "string" || !/^[0-9a-f-]{36}$/i.test(b.avatar)) return "El avatar no es válido: usa el id de uno de tus avatares (GET /api/v1/avatares).";
    avatarId = b.avatar;
  }
  return { guion, formato, idioma, modelo, titulo, sello: b.sello === true, edicion: b.edicion === "simple" ? "simple" : "pro", ...(b.subtitulos === false ? { subtitulos: false } : {}), ...(typeof b.indicaciones === "string" && b.indicaciones.trim() ? { indicaciones: b.indicaciones.trim().slice(0, 600) } : {}),
    ...(typeof b.plantilla === "string" || typeof b.color === "string" ? { look: { plantilla: typeof b.plantilla === "string" ? b.plantilla.slice(0, 20) : undefined, c1: typeof b.color === "string" ? b.color.slice(0, 7) : undefined, c2: typeof b.color2 === "string" ? b.color2.slice(0, 7) : undefined } } : {}), ...(avatarId ? { avatarId } : {}) };
}

export async function createAd(ws: string, userId: string, o: Exclude<ReturnType<typeof readOrder>, string>): Promise<ApiAd> {
  const now = new Date().toISOString();
  const job: ApiAd = { id: `ad_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, ws, userId, createdAt: now, updatedAt: now, estado: "cola", paso: "En cola", ...o };
  await writePrivateJSON(file(ws, job.id), job);
  const idx = ((await readPrivateJSON<string[]>(indexFile(ws)).catch(() => null)) ?? []).filter((x) => x !== job.id);
  await writePrivateJSON(indexFile(ws), [job.id, ...idx].slice(0, 100));
  return job;
}

export const loadAd = (ws: string, id: string) => (/^ad_[a-z0-9]{6,20}$/.test(id) ? readPrivateJSON<ApiAd>(file(ws, id)).catch(() => null) : Promise.resolve(null));
export const listAds = async (ws: string) => (await Promise.all(((await readPrivateJSON<string[]>(indexFile(ws)).catch(() => null)) ?? []).slice(0, 30).map((id) => loadAd(ws, id)))).filter((x): x is ApiAd => Boolean(x));

/** The studio's endpoints with the caller's own credentials (its API key or its session cookie). */
export function studioAs(req: Request): Studio {
  const auth = req.headers.get("authorization");
  const cookie = req.headers.get("cookie");
  return async <T,>(path: string, body?: unknown, timeoutMs = 240_000): Promise<T> => {
    const res = await fetch(`${SITE}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : cookie ? { cookie } : {}), "user-agent": "CreadsAPI/1.0" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const d = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(d.error || `El estudio respondió ${res.status}.`);
    return d;
  };
}

/**
 * Advances a job one step and returns it as it is now. Only one runner per version of the job (two polls at
 * the same time can't both start the clips: that would charge twice); every run records `checkedAt`, so the
 * next poll may run again, while `updatedAt` only moves with real progress (the 3-hour clock).
 */
export async function advanceAd(job: ApiAd, studio: Studio): Promise<ApiAd> {
  if (DONE.has(job.estado) || !(await once(`apiad:${job.id}:${job.checkedAt ?? job.updatedAt}`, 900))) return job;
  const patch = await runStep(job, studio, () => pickModel({ modelo: job.modelo ?? "" }), job.sello);
  const now = new Date().toISOString();
  const next: ApiAd = { ...job, ...patch, checkedAt: now, ...(Object.keys(patch).length ? { updatedAt: now } : {}) };
  await writePrivateJSON(file(job.ws, job.id), next);
  return next;
}

/** What the caller sees (absolute link to the video; it opens with the same API key). */
export const publicAd = (j: ApiAd) => ({
  id: j.id, estado: j.estado, paso: j.paso ?? null, titulo: j.titulo, formato: j.formato, idioma: j.idioma, modelo: j.modelo ?? null, avatar: j.avatarId ?? null,
  video_url: j.videoUrl ? (j.videoUrl.startsWith("http") ? j.videoUrl : `${SITE}${j.videoUrl}`) : null,
  error: j.error ?? null, creado: j.createdAt, actualizado: j.updatedAt,
});
