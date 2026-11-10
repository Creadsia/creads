import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { WORKER_USD_HR, gpuConfig, gpuControlOn, gpuHealth, gpuSetActive } from "@/lib/providers/runpod-control";

export const dynamic = "force-dynamic";

// Panel admin → Workers GPU: estado en vivo (GET) y prender/apagar los workers calientes (POST { workersMin, idleTimeout }).
// Solo el owner. workersMin = cuántos quedan siempre calientes (0 = apagado).

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
  return NextResponse.json({
    health: h.status === "fulfilled" ? h.value : { workers: { idle: 0, running: 0 }, jobs: {} },
    config: c.status === "fulfilled" ? c.value : null,
    manage: c.status === "fulfilled",
    manageError: c.status === "rejected" ? (c.reason instanceof Error ? c.reason.message : "error") : undefined,
    usdHr: WORKER_USD_HR,
  });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return bad("No autorizado.", 401);
  if (!gpuControlOn()) return bad("Falta configurar RUNPOD_API_KEY y RUNPOD_ITK_ENDPOINT.", 503);
  let body: { workersMin?: number; idleTimeout?: number };
  try { body = await req.json(); } catch { return bad("Body inválido."); }
  if (typeof body.workersMin !== "number" || body.workersMin < 0 || body.workersMin > 10) return bad("workersMin debe ser 0 a 10.");
  try {
    const config = await gpuSetActive(body.workersMin, body.idleTimeout);
    return NextResponse.json({ ok: true, config, usdHr: WORKER_USD_HR });
  } catch (err) {
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403) {
      return bad("RunPod rechazó el cambio (sin permisos). Necesitas una API key de RunPod con permisos de administración: créala en RunPod → Settings → API Keys (acceso total) y ponla en Vercel como RUNPOD_MANAGE_KEY.", 403);
    }
    return bad(err instanceof Error ? err.message : "No se pudo cambiar los workers.", 502);
  }
}
