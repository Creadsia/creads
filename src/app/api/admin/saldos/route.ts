import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { type Service, clearOutage, overview, setUmbrales } from "@/lib/balances";

export const dynamic = "force-dynamic";

// Money left in each outside service, with alerts (owner only).
// ?alertas=1 returns only the alerts (for the banner in the studio), from readings up to a minute old.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    if (new URL(req.url).searchParams.get("alertas")) return NextResponse.json({ alerts: (await overview(false)).alerts });
    return NextResponse.json(await overview());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo revisar los saldos." }, { status: 502 });
  }
}

// PUT {umbrales:{fal, google, eleven}} saves the alert levels; PUT {listo:"fal"} hides a past failure.
export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => null);
  try {
    if (b?.listo) {
      const svc = String(b.listo) as Service;
      if (!["fal", "google", "eleven", "claude"].includes(svc)) return NextResponse.json({ error: "Servicio desconocido." }, { status: 400 });
      await clearOutage(svc);
    } else {
      const n = (v: unknown, max: number) => {
        const x = Number(v);
        return isFinite(x) && x >= 0 && x <= max ? x : null;
      };
      const fal = n(b?.umbrales?.fal, 100000), google = n(b?.umbrales?.google, 100000), eleven = n(b?.umbrales?.eleven, 100), diario = n(b?.umbrales?.diario, 100000);
      if (fal == null || google == null || eleven == null || diario == null) return NextResponse.json({ error: "Revisa los montos." }, { status: 400 });
      await setUmbrales({ fal, google, eleven, diario });
    }
    return NextResponse.json(await overview());
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo guardar." }, { status: 502 });
  }
}
