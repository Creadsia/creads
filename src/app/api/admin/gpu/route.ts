import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { WORKER_USD_HR, WORKERS_TOPE_MAX, AUTO_TOPE_DEF, type GpuMode, gpuConfig, gpuControlOn, gpuHealth, gpuModeFrom, gpuSetActive, gpuSetMode } from "@/lib/providers/runpod-control";

export const dynamic = "force-dynamic";

// Panel admin → Workers GPU: estado en vivo (GET) y cambiar el modo del motor (POST).
// Solo el owner. Tres modos (ver runpod-control.ts): apagado · automatico (se prende solo cuando pide un
// cliente, US$0 en reposo) · caliente (N siempre listos). POST acepta { mode, n } o, por compat, { workersMin }.

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET() {
  if (!(await isAdmin())) return bad("No autorizado.", 401);
  if (!gpuControlOn()) return bad("Falta configurar RUNPOD_API_KEY y RUNPOD_ITK_ENDPOINT.", 503);
  // El estado en vivo (health, API /v2) usa la misma key que genera videos. La config/control (rest.runpod.io)
  // puede necesitar una key con permisos de administración: si falla, igual mostramos el estado en vivo.
  const [h, c] = await Promise.allSettled([gpuHealth(), gpuConfig()]);
  if (h.status === "rejected" && c.status === "rejected") {
    return bad(h.reason instanceof Error ? h.reason.message : "No se pudo leer el estado de RunPod.", 502);
  }
  const cfg = c.status === "fulfilled" ? c.value : null;
  return NextResponse.json({
    health: h.status === "fulfilled" ? h.value : { workers: { idle: 0, running: 0 }, jobs: {} },
    config: cfg,
    modo: cfg ? gpuModeFrom(cfg) : null,
    manage: c.status === "fulfilled",
    manageError: c.status === "rejected" ? (c.reason instanceof Error ? c.reason.message : "error") : undefined,
    usdHr: WORKER_USD_HR,
    topeMax: WORKERS_TOPE_MAX,
    autoTopeDef: AUTO_TOPE_DEF,
  });
}

const noPermiso = (status?: number) =>
  status === 401 || status === 403
    ? "RunPod rechazó el cambio (sin permisos). Necesitas una API key de RunPod con permisos de administración: créala en RunPod → Settings → API Keys (acceso total) y ponla en Vercel como RUNPOD_MANAGE_KEY."
    : null;

export async function POST(req: Request) {
  if (!(await isAdmin())) return bad("No autorizado.", 401);
  if (!gpuControlOn()) return bad("Falta configurar RUNPOD_API_KEY y RUNPOD_ITK_ENDPOINT.", 503);
  let body: { mode?: GpuMode; n?: number; workersMin?: number; idleTimeout?: number };
  try { body = await req.json(); } catch { return bad("Body inválido."); }

  try {
    let config;
    if (body.mode) {
      // Forma nueva: { mode: "apagado" | "automatico" | "caliente", n? }
      if (!["apagado", "automatico", "caliente"].includes(body.mode)) return bad("mode inválido.");
      const n = typeof body.n === "number" ? body.n : undefined;
      if (body.mode === "caliente" && (n == null || n < 1 || n > 10)) return bad("Para caliente, n debe ser 1 a 10.");
      if (body.mode === "automatico" && n != null && (n < 1 || n > WORKERS_TOPE_MAX)) return bad(`El tope (n) debe ser 1 a ${WORKERS_TOPE_MAX}.`);
      config = await gpuSetMode(body.mode, n);
    } else if (typeof body.workersMin === "number") {
      // Compat: forma vieja { workersMin }.
      if (body.workersMin < 0 || body.workersMin > 10) return bad("workersMin debe ser 0 a 10.");
      config = await gpuSetActive(body.workersMin, body.idleTimeout);
    } else {
      return bad("Falta 'mode' (apagado/automatico/caliente) o 'workersMin'.");
    }
    return NextResponse.json({ ok: true, config, modo: gpuModeFrom(config), usdHr: WORKER_USD_HR });
  } catch (err) {
    const msg = noPermiso((err as { status?: number })?.status);
    if (msg) return bad(msg, 403);
    return bad(err instanceof Error ? err.message : "No se pudo cambiar los workers.", 502);
  }
}
