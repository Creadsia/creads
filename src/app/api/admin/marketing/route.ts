import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { campaigns, commitMarketing, finishedAds, loadMarketing, repliesToday } from "@/lib/marketing";
import { metaAds, metaToken } from "@/lib/meta-graph";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Owner only. Panel → Marketing. GET: connection status, settings, campaigns (live from Meta), ad requests,
// publications and the finished Creads ads. PATCH: the cap, the Instagram accounts, the auto-reply and the
// state of an ad request.
const no = () => NextResponse.json({ error: "No autorizado." }, { status: 401 });
const env = (k: string) => Boolean((process.env[k] ?? "").trim());

export async function GET() {
  if (!(await isAdmin())) return no();
  const [m, ads, hoy] = await Promise.all([loadMarketing(), finishedAds(20).catch(() => []), repliesToday().catch(() => 0)]);
  let camp: Awaited<ReturnType<typeof campaigns>> | null = null, metaError = "";
  try { camp = await campaigns(); } catch (e) { metaError = e instanceof Error ? e.message : "No se pudo leer Meta."; }
  return NextResponse.json({
    conexion: {
      anuncios: Boolean(metaAds()), token: Boolean(metaToken()), instagramAnuncios: env("META_IG_USER_ID"),
      webhook: env("META_WEBHOOK_VERIFY_TOKEN") && env("META_APP_SECRET"), pixel: env("NEXT_PUBLIC_META_PIXEL_ID") || env("META_PIXEL_ID"),
      error: metaError,
    },
    estado: m, respuestasHoy: hoy, campanasMeta: camp?.rows ?? [], moneda: camp && "currency" in camp ? camp.currency : null, anuncios: ads,
  });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return no();
  const b = await req.json().catch(() => null);
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
  if (b?.capUsd !== undefined && !(Number(b.capUsd) >= 0 && Number(b.capUsd) <= 5000)) return bad("El tope diario debe ser entre US$0 y US$5.000.");
  if (b?.cuenta && (!/^\d{5,30}$/.test(String(b.cuenta.igUserId ?? "")) || String(b.cuenta.nombre ?? "").trim().length < 2)) return bad("La cuenta necesita un nombre y su número de Instagram (solo dígitos).");
  await commitMarketing((s) => {
    if (b?.capUsd !== undefined) s.capUsd = Math.round(Number(b.capUsd) * 100) / 100;
    if (b?.cuenta) {
      const c = { id: `ig-${String(b.cuenta.igUserId)}`, nombre: String(b.cuenta.nombre).trim().slice(0, 60), igUserId: String(b.cuenta.igUserId), pageId: /^\d{5,30}$/.test(String(b.cuenta.pageId ?? "")) ? String(b.cuenta.pageId) : undefined };
      s.cuentas = [...s.cuentas.filter((x) => x.igUserId !== c.igUserId), c].slice(0, 20);
    }
    if (typeof b?.quitarCuenta === "string") s.cuentas = s.cuentas.filter((x) => x.id !== b.quitarCuenta);
    if (b?.autoReply && typeof b.autoReply === "object") {
      const a = b.autoReply;
      if (typeof a.on === "boolean") s.autoReply.on = a.on;
      if (Array.isArray(a.palabras)) s.autoReply.palabras = a.palabras.map((p: unknown) => String(p).trim().slice(0, 40)).filter(Boolean).slice(0, 30);
      if (typeof a.mensaje === "string") s.autoReply.mensaje = a.mensaje.trim().slice(0, 900);
      if (typeof a.publico === "string") s.autoReply.publico = a.publico.trim().slice(0, 300);
      if (a.maxPorHora !== undefined) s.autoReply.maxPorHora = Math.max(1, Math.min(200, Math.round(Number(a.maxPorHora) || 30)));
    }
    if (typeof b?.pedido === "string" && ["pendiente", "en producción", "listo"].includes(b.estado)) {
      const p = s.pedidos.find((x) => x.id === b.pedido);
      if (p) p.estado = b.estado;
    }
  });
  return GET();
}
