import { randomUUID } from "node:crypto";

// Comfy Router (api.comfy.org): one queue API for partner models. Used for Higgsfield's Genjutsu (motion
// transfer: recasts the person of a video with reference images, keeping camera, timing, background and
// sound), which Higgsfield doesn't offer in its own API. Key: COMFY_API_KEY (made in a Comfy *workspace*,
// required for the queue). Docs: docs.comfy.org/development/comfy-router/queue.
// Protocol: POST …/requests (201, with an Idempotency-Key) → GET …/requests/{id} (202 while running, 200 with
// the model's own output when done, an error with X-Comfy-Error-Type when it failed). Results kept 24 h.

const BASE = "https://api.comfy.org/v2/models";
export const GENJUTSU = "higgsfield/higgsfield-genjutsu-motion-transfer-v1.0";

export const comfyConfigured = () => (process.env.COMFY_API_KEY ?? "").trim().length > 10;
const headers = () => ({ "X-API-Key": (process.env.COMFY_API_KEY ?? "").trim(), "content-type": "application/json" });

/** Plain words for Comfy's error types (the owner sees them; customers get a safe version). */
function plain(type: string | null, status: number, what: string) {
  switch (type) {
    case "insufficient_credits": return `${what}: se acabó el saldo en Comfy (platform.comfy.org). Carga saldo y vuelve a intentar.`;
    case "not_enabled": return `${what}: la clave de Comfy no tiene la cola activada (debe crearse dentro de un workspace de Comfy).`;
    case "invalid_input": return `${what}: el video o las imágenes no sirven para este modelo (el video debe durar entre 4 y 30 segundos).`;
    case "rate_limited": case "concurrency_limit_exceeded": return `${what}: hay demasiados videos al mismo tiempo. Intenta en un minuto.`;
    case "model_not_found": return `${what}: el modelo ya no está disponible en Comfy.`;
    default: return `${what}: el servicio respondió con un error (${type ?? status}).`;
  }
}

/** Starts a job on the queue. Returns the request id. */
export async function comfySubmit(model: string, body: Record<string, unknown>, what: string): Promise<string> {
  const res = await fetch(`${BASE}/${model}/requests`, { method: "POST", headers: { ...headers(), "Idempotency-Key": randomUUID() }, body: JSON.stringify(body) });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("comfy submit", res.status, res.headers.get("x-comfy-error-type"), detail.slice(0, 300));
    throw new Error(plain(res.headers.get("x-comfy-error-type"), res.status, what));
  }
  const d = (await res.json().catch(() => null)) as { request_id?: string } | null;
  if (!d?.request_id || !/^[\w-]{6,80}$/.test(d.request_id)) throw new Error(`${what}: no devolvió un trabajo.`);
  return d.request_id;
}

export type ComfyCheck = { state: "queued" | "running" } | { state: "failed"; error: string } | { state: "done"; out: Record<string, unknown> };

/** Checks a job; when done, returns the model's own output. */
export async function comfyPoll(model: string, id: string, what: string): Promise<ComfyCheck> {
  if (!/^[\w-]{6,80}$/.test(id)) return { state: "failed", error: "Trabajo inválido." };
  const res = await fetch(`${BASE}/${model}/requests/${id}`, { headers: headers(), cache: "no-store" });
  if (res.status === 202) {
    const s = (await res.json().catch(() => null)) as { status?: string } | null;
    return { state: s?.status === "IN_QUEUE" ? "queued" : "running" };
  }
  if (res.status === 410) return { state: "failed", error: `${what}: el resultado ya no está disponible (pasaron más de 24 horas).` };
  if (!res.ok) return { state: "failed", error: plain(res.headers.get("x-comfy-error-type"), res.status, what) };
  const out = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!out) return { state: "failed", error: `${what}: respuesta inesperada.` };
  const st = String(out.status ?? "").toLowerCase();
  if (st === "nsfw") return { state: "failed", error: `${what}: el resultado fue bloqueado por el filtro de contenido.` };
  if (st === "failed" || st === "canceled" || st === "cancelled") return { state: "failed", error: `${what}: ${String(out.error ?? "no se pudo generar.")}` };
  if (st === "queued") return { state: "queued" };
  if (st === "in_progress") return { state: "running" };
  return { state: "done", out };
}

/** The video link in Genjutsu's output ({video: {url}}), tolerant to small shape changes. */
export function comfyVideo(out: Record<string, unknown>): string | undefined {
  const v = out.video as { url?: string } | string | undefined;
  if (typeof v === "string") return v;
  if (v?.url) return v.url;
  const list = (out.videos as { url?: string }[] | undefined) ?? [];
  return list[0]?.url ?? (typeof out.url === "string" ? out.url : undefined);
}
