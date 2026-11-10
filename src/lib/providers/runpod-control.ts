// Control del endpoint serverless de RunPod desde el panel admin (owner, 10 nov 2026: «una zona en Creads para
// prender/apagar los workers calientes»). Usa RUNPOD_API_KEY + RUNPOD_ITK_ENDPOINT (ya están en Vercel).
//   - Estado en vivo:   GET https://api.runpod.ai/v2/{endpoint}/health  -> workers {idle,running,ready,throttled}, jobs {...}
//   - Config actual:    GET https://rest.runpod.io/v1/endpoints/{id}    -> { workersMin, workersMax, idleTimeout, ... }
//   - Cambiar calientes: PATCH https://rest.runpod.io/v1/endpoints/{id}  { workersMin, idleTimeout }
// workersMin = «Active workers» = los que quedan siempre prendidos (calientes), facturados aunque estén idle.

const endpoint = () => (process.env.RUNPOD_ITK_ENDPOINT ?? "").trim();
const key = () => (process.env.RUNPOD_API_KEY ?? "").trim();
export const gpuControlOn = () => Boolean(endpoint() && key());

const headers = () => ({ "content-type": "application/json", authorization: `Bearer ${key()}` });

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

async function j<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, headers: headers(), cache: "no-store" });
  const text = await r.text();
  if (!r.ok) throw new Error(`RunPod ${r.status}: ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export async function gpuHealth(): Promise<GpuHealth> {
  const d = await j<GpuHealth>(`https://api.runpod.ai/v2/${endpoint()}/health`);
  return { workers: d.workers ?? { idle: 0, running: 0 }, jobs: d.jobs ?? {} };
}

export async function gpuConfig(): Promise<GpuConfig> {
  const d = await j<Record<string, unknown>>(`https://rest.runpod.io/v1/endpoints/${endpoint()}`);
  return {
    workersMin: Number(d.workersMin ?? 0),
    workersMax: Number(d.workersMax ?? 0),
    idleTimeout: Number(d.idleTimeout ?? 0),
  };
}

/** Deja `min` workers siempre calientes (0 = apagado). idleTimeout en segundos (opcional). */
export async function gpuSetActive(min: number, idleTimeout?: number): Promise<GpuConfig> {
  const body: Record<string, number> = { workersMin: Math.max(0, Math.min(10, Math.round(min))) };
  if (idleTimeout != null) body.idleTimeout = Math.max(1, Math.min(3600, Math.round(idleTimeout)));
  const d = await j<Record<string, unknown>>(`https://rest.runpod.io/v1/endpoints/${endpoint()}`, { method: "PATCH", body: JSON.stringify(body) });
  return {
    workersMin: Number(d.workersMin ?? body.workersMin),
    workersMax: Number(d.workersMax ?? 0),
    idleTimeout: Number(d.idleTimeout ?? idleTimeout ?? 0),
  };
}
