import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { qualityStats } from "@/lib/calidad";
import { sharedRules } from "@/lib/db";

export const dynamic = "force-dynamic";

// Owner and partners. Plataforma → Calidad. GET ?dias=7|30|90. PATCH {aprobar:id} | {descartar:id} (learned rules).
const no = () => NextResponse.json({ error: "No autorizado." }, { status: 401 });

export async function GET(req: Request) {
  if (!(await isAdmin())) return no();
  const d = Number(new URL(req.url).searchParams.get("dias"));
  return NextResponse.json(await qualityStats([7, 30, 90].includes(d) ? d : 30));
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return no();
  const b = await req.json().catch(() => null);
  const id = String(b?.aprobar ?? b?.descartar ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ error: "Falta la regla." }, { status: 400 });
  // approved: it goes into every character video from now on; discarded: it never does
  await sharedRules.update(id, b?.aprobar ? { active: true } : { active: false, formats: ["descartada"] });
  return NextResponse.json({ ok: true });
}
