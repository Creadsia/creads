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
  try {
    const [health, config] = await Promise.all([gpuHealth(), gpuConfig()]);
    return NextResponse.json({ health, config, usdHr: WORKER_USD_HR });
  } catch (err) {
    return bad(err instanceof Error ? err.message : "No se pudo leer el estado de RunPod.", 502);
  }
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
    return bad(err instanceof Error ? err.message : "No se pudo cambiar los workers.", 502);
  }
}
