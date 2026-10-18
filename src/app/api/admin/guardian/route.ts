import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { cleanConfig, commitGuard, loadGuard, runGuardian } from "@/lib/guardian";
import { pauseModel, pausedModels, unpauseModel } from "@/lib/model-pause";
import { sendWhatsApp, whatsappMode } from "@/lib/whatsapp";
import { videoProviders } from "@/lib/providers";
import { SITE } from "@/lib/emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Owner only. Plataforma → Guardián. GET: checks, incidents, paused models, how alerts reach the owner.
// POST: check everything now. PATCH {config} | {pausar:{id,horas}} | {reactivar:id} | {probarWhatsapp} | {cerrar:key}.
const no = () => NextResponse.json({ error: "No autorizado." }, { status: 401 });

async function view() {
  const [st, paused] = await Promise.all([loadGuard(), pausedModels(true)]);
  const token = (process.env.GUARDIAN_TOKEN ?? "").trim();
  return {
    ...st, paused,
    modelos: videoProviders.filter((p) => p.configured()).map((p) => ({ id: p.id, label: p.label })),
    whatsapp: whatsappMode(),
    monitorUrl: token.length >= 24 ? `${SITE}/api/guardian?t=${encodeURIComponent(token)}` : null,
  };
}

export async function GET() {
  if (!(await isAdmin())) return no();
  return NextResponse.json(await view());
}

export async function POST() {
  if (!(await isAdmin())) return no();
  try { await runGuardian({ force: true }); } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo revisar." }, { status: 502 }); }
  return NextResponse.json(await view());
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return no();
  const b = await req.json().catch(() => null);
  if (b?.config && typeof b.config === "object") await commitGuard((s) => { s.config = cleanConfig(b.config, s.config); });
  if (b?.pausar && videoProviders.some((p) => p.id === b.pausar.id)) await pauseModel(b.pausar.id, Math.min(48, Math.max(1, Number(b.pausar.horas) || 2)), "Pausado a mano por el dueño", "dueño");
  if (typeof b?.reactivar === "string") await unpauseModel(b.reactivar);
  if (typeof b?.cerrar === "string") await commitGuard((s) => { const i = s.incidents.find((x) => x.key === b.cerrar && x.abierto); if (i) { i.abierto = false; i.resueltoAt = new Date().toISOString(); i.acciones = [...i.acciones, "Cerrado a mano por el dueño."]; } });
  if (b?.probarWhatsapp) {
    const r = await sendWhatsApp("✅ Creads · Prueba del Guardián: así te van a llegar las alertas importantes.");
    if (!r.ok) return NextResponse.json({ error: r.error ?? "No se pudo enviar." }, { status: 502 });
  }
  return NextResponse.json(await view());
}
