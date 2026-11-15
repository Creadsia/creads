// Control del endpoint serverless de RunPod desde el panel admin (owner, 10 nov 2026: «una zona en Creads para
// prender/apagar los workers calientes»). Usa RUNPOD_API_KEY + RUNPOD_ITK_ENDPOINT (ya están en Vercel).
//   - Estado en vivo:   GET https://api.runpod.ai/v2/{endpoint}/health  -> workers {idle,running,ready,throttled}, jobs {...}
//   - Config actual:    GET https://rest.runpod.io/v1/endpoints/{id}    -> { workersMin, workersMax, idleTimeout, ... }
//   - Cambiar calientes: PATCH https://rest.runpod.io/v1/endpoints/{id}  { workersMin, idleTimeout }
// workersMin = «Active workers» = los que quedan siempre prendidos (calientes), facturados aunque estén idle.

const endpoint = () => (process.env.RUNPOD_ITK_ENDPOINT ?? "").trim();
const key = () => (process.env.RUNPOD_API_KEY ?? "").trim();
// La API de administración (rest.runpod.io: leer/cambiar config) puede necesitar una key con permisos de
// administración, distinta de la que corre los videos (/v2). Si existe RUNPOD_MANAGE_KEY la usamos para eso.
const manageKey = () => (process.env.RUNPOD_MANAGE_KEY ?? "").trim() || key();
export const gpuControlOn = () => Boolean(endpoint() && key());
export const gpuManageOn = () => Boolean(endpoint() && manageKey());

const headers = () => ({ "content-type": "application/json", authorization: `Bearer ${key()}` });
const manageHeaders = () => ({ "content-type": "application/json", authorization: `Bearer ${manageKey()}` });

/** US$/hora de un worker caliente. El endpoint corre en una GPU PRO de 48 GB = US$1,75/h (RunPod, nov 2026).
 *  Se puede sobreescribir con RUNPOD_WORKER_USD_HR si cambias de GPU. */
export const WORKER_USD_HR = Number(process.env.RUNPOD_WORKER_USD_HR ?? "1.75") || 1.75;

export interface GpuHealth {
  workers: { idle: number; running: number; ready?: number; throttled?: number; initializing?: number };
  jobs: { inProgress?: number; inQueue?: number; completed?: number; failed?: number; retried?: number };
}
export interface GpuConfig {
  workersMin: number;
  workersMax: number;
  idleTimeout: number;
}

async function j<T>(url: string, hdrs: Record<string, string>, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: hdrs, cache: "no-store" });
  const text = await r.text();
  if (!r.ok) {
    const e = new Error(`RunPod ${r.status}: ${text.slice(0, 160)}`) as Error & { status?: number };
    e.status = r.status;
    throw e;
  }
  return (text ? JSON.parse(text) : {}) as T;
}

export async function gpuHealth(): Promise<GpuHealth> {
  const d = await j<GpuHealth>(`https://api.runpod.ai/v2/${endpoint()}/health`, headers());
  return { workers: d.workers ?? { idle: 0, running: 0 }, jobs: d.jobs ?? {} };
}

export async function gpuConfig(): Promise<GpuConfig> {
  const d = await j<Record<string, unknown>>(`https://rest.runpod.io/v1/endpoints/${endpoint()}`, manageHeaders());
  return {
    workersMin: Number(d.workersMin ?? 0),
    workersMax: Number(d.workersMax ?? 0),
    idleTimeout: Number(d.idleTimeout ?? 0),
  };
}

/** Los tres modos del motor:
 *  - apagado:    workersMin 0, workersMax 0  → nada corre (ni aunque llegue un cliente). US$0.
 *  - automatico: workersMin 0, workersMax N  → se prende en frío SOLO cuando llega un trabajo. US$0 en reposo,
 *                el cliente espera el arranque (~20-40 s) la primera vez. El modo ideal con poco tráfico.
 *  - caliente:   workersMin N (≥1)           → N workers siempre listos, sin espera. Cuesta aunque no se use. */
export type GpuMode = "apagado" | "automatico" | "caliente";

/** Deduce el modo actual a partir de la config de RunPod. `n` = calientes (modo caliente) o tope (automatico). */
export function gpuModeFrom(c: Pick<GpuConfig, "workersMin" | "workersMax">): { mode: GpuMode; n: number } {
  if (c.workersMin > 0) return { mode: "caliente", n: c.workersMin };
  if (c.workersMax > 0) return { mode: "automatico", n: c.workersMax };
  return { mode: "apagado", n: 0 };
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(n)));

/** Tope máximo de workers que el panel permite pedir. RunPod igual lo recorta al límite real de la cuenta. */
export const WORKERS_TOPE_MAX = Number(process.env.RUNPOD_WORKERS_TOPE_MAX ?? "50") || 50;
/** Tope por defecto del modo Automático: alto, para que un pedido grande (p.ej. 15 videos) prenda muchos a la vez. */
export const AUTO_TOPE_DEF = clamp(Number(process.env.RUNPOD_AUTO_TOPE ?? "20") || 20, 1, WORKERS_TOPE_MAX);

/** Cambia el escalado del endpoint. Setea solo los campos que le pasas (workersMin, workersMax, idleTimeout). */
export async function gpuSetScale(s: { workersMin?: number; workersMax?: number; idleTimeout?: number }): Promise<GpuConfig> {
  const body: Record<string, number> = {};
  if (s.workersMin != null) body.workersMin = clamp(s.workersMin, 0, 10); // calientes: hasta 10 (no tiene sentido pagar más fijos)
  if (s.workersMax != null) body.workersMax = clamp(s.workersMax, 0, WORKERS_TOPE_MAX); // tope de autoescalado: alto
  if (s.idleTimeout != null) body.idleTimeout = clamp(s.idleTimeout, 1, 3600);
  // El tope nunca puede ser menor que los calientes.
  if (body.workersMin != null && body.workersMax != null && body.workersMax < body.workersMin) body.workersMax = body.workersMin;
  const d = await j<Record<string, unknown>>(`https://rest.runpod.io/v1/endpoints/${endpoint()}`, manageHeaders(), { method: "PATCH", body: JSON.stringify(body) });
  return {
    workersMin: Number(d.workersMin ?? body.workersMin ?? 0),
    workersMax: Number(d.workersMax ?? body.workersMax ?? 0),
    idleTimeout: Number(d.idleTimeout ?? body.idleTimeout ?? 0),
  };
}

/** Aplica un modo. `n` = cuántos calientes (modo caliente) o el tope de autoescalado (modo automatico, def. alto). */
export async function gpuSetMode(mode: GpuMode, n?: number): Promise<GpuConfig> {
  if (mode === "apagado") return gpuSetScale({ workersMin: 0, workersMax: 0 });
  if (mode === "automatico") return gpuSetScale({ workersMin: 0, workersMax: clamp(n || AUTO_TOPE_DEF, 1, WORKERS_TOPE_MAX), idleTimeout: 300 });
  // caliente: N siempre prendidos, con tope alto para que igual escale si entran varios pedidos a la vez.
  const min = clamp(n || 1, 1, 10);
  return gpuSetScale({ workersMin: min, workersMax: Math.max(min, AUTO_TOPE_DEF), idleTimeout: 300 });
}

/** Compat: deja `min` calientes (0 = apagado total). Prefiere gpuSetMode. */
export async function gpuSetActive(min: number, idleTimeout?: number): Promise<GpuConfig> {
  return gpuSetScale({ workersMin: min, ...(idleTimeout != null ? { idleTimeout } : {}) });
}
