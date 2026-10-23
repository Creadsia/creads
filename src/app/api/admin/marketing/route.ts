import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/admin";
import { addIdea, campaigns, commitMarketing, finishedAds, loadMarketing, repliesToday } from "@/lib/marketing";
import { metaAds, metaToken, probarMeta } from "@/lib/meta-graph";
import { diagnosticoMeta } from "@/lib/meta-diagnostico";
import { videoProviders } from "@/lib/providers";
import { DEFAULT_AUTOPROD, isEvento } from "@/lib/marketing";
import { metaConnView, saveMetaConn } from "@/lib/meta-conexiones";
import { DEFAULT_PAUSA, decidirReel, kickPiloto, pilotoOf } from "@/lib/piloto";
import { sbRest } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Owner only. Panel → Marketing. GET: connection status, settings, campaigns (live from Meta), ad requests,
// publications and the finished Creads ads. PATCH: the cap, the Instagram accounts, the auto-reply and the
// state of an ad request.
const no = () => NextResponse.json({ error: "No autorizado." }, { status: 401 });

export async function GET() {
  if (!(await isAdmin())) return no();
  const [m, ads, hoy] = await Promise.all([loadMarketing(), finishedAds(20).catch(() => []), repliesToday().catch(() => 0)]);
  let camp: Awaited<ReturnType<typeof campaigns>> | null = null, metaError = "";
  try { camp = await campaigns(); } catch (e) { metaError = e instanceof Error ? e.message : "No se pudo leer Meta."; }
  const view = await metaConnView();
  // the brand's avatars and characters, to put one on each account (organic autopilot)
  const avatares = await sbRest<{ id: string; name: string; description: string | null }[]>("avatars?owner=eq.main&select=id,name,description&order=created_at.desc&limit=100").catch(() => []);
  return NextResponse.json({
    avatares: avatares.map((a) => ({ id: a.id, nombre: a.name })),
    pausaAuto: { ...DEFAULT_PAUSA, ...(m.pausaAuto ?? {}) },
    conexion: {
      anuncios: Boolean(await metaAds()), token: Boolean(await metaToken()), instagramAnuncios: Boolean(view.igUserId.value),
      webhook: Boolean(view.webhookToken.value && view.appSecret.value), pixel: Boolean(view.pixelId.value), capi: Boolean(view.capiToken.value),
      error: metaError,
    },
    conexiones: view,
    autoProd: { ...DEFAULT_AUTOPROD, ...(m.autoProd ?? {}) },
    modelosVideo: videoProviders.filter((p) => p.configured() && !p.silent && !p.needsImage).map((p) => ({ id: p.id, label: p.label, usdPorSeg: p.usdPerSecond })),
    estado: m, respuestasHoy: hoy, campanasMeta: camp?.rows ?? [], moneda: camp && "currency" in camp ? camp.currency : null, anuncios: ads,
  });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return no();
  const b = await req.json().catch(() => null);
  const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
  if (b?.conexiones && typeof b.conexiones === "object") {
    const me = await currentUser();
    const e = await saveMetaConn(b.conexiones, me?.email ?? "panel");
    if (e) return bad(e);
  }
  if (typeof b?.producir === "string" || typeof b?.reintentar === "string") {
    const { enqueue, kickProduction } = await import("@/lib/autoprod");
    if (typeof b.reintentar === "string") await commitMarketing((s) => { s.produccion = (s.produccion ?? []).filter((j) => !(j.pedidoId === b.reintentar && j.estado === "error")); });
    const ped = (await loadMarketing()).pedidos.find((p) => p.id === (b.producir ?? b.reintentar));
    if (!ped) return bad("Ese pedido ya no existe.");
    const ok = await enqueue(ped);
    if (!ok) return bad("La producción automática está apagada o ese pedido ya está en producción.");
    await kickProduction();
    return GET();
  }
  if (b?.reel && typeof b.reel === "object" && typeof b.reel.id === "string" && ["aprobar", "descartar", "editar"].includes(b.reel.accion)) {
    await decidirReel(b.reel.id, b.reel.accion, { guion: typeof b.reel.guion === "string" ? b.reel.guion : undefined, caption: typeof b.reel.caption === "string" ? b.reel.caption : undefined });
    if (b.reel.accion === "aprobar") await kickPiloto();
    return GET();
  }
  if (typeof b?.aprobarTodo === "string") {
    await commitMarketing((s) => { for (const r of s.reels ?? []) if (r.cuentaId === b.aprobarTodo && r.estado === "propuesta") { r.estado = "aprobada"; r.updatedAt = new Date().toISOString(); } });
    await kickPiloto();
    return GET();
  }
  if (b?.piloto && typeof b.piloto === "object" && typeof b.piloto.cuentaId === "string") {
    const p = b.piloto;
    if (p.avatarId !== undefined && p.avatarId !== "" && !/^[0-9a-f-]{36}$/i.test(String(p.avatarId))) return bad("Ese avatar no es válido.");
    await commitMarketing((s) => {
      const c = s.cuentas.find((x) => x.id === p.cuentaId);
      if (!c) return;
      const cur = pilotoOf(c);
      if (p.avatarId !== undefined) c.avatarId = p.avatarId ? String(p.avatarId) : undefined;
      if (["profesor", "personaje", "marca"].includes(p.rol)) c.rol = p.rol;
      if (typeof p.angulo === "string") c.angulo = p.angulo.trim().slice(0, 300) || undefined;
      const horas = Array.isArray(p.horas) ? [...new Set(p.horas.map(Number).filter((h: number) => Number.isInteger(h) && h >= 0 && h <= 23))].slice(0, 6) as number[] : cur.horas;
      c.piloto = {
        ...cur,
        on: typeof p.on === "boolean" ? p.on : cur.on,
        porDia: p.porDia !== undefined ? Math.max(1, Math.min(3, Math.round(Number(p.porDia) || 1))) : cur.porDia,
        horas: horas.length ? horas : cur.horas,
        revisar: typeof p.revisar === "boolean" ? p.revisar : cur.revisar,
        ...(p.planearAhora === true ? { planAt: undefined } : {}),
      };
    });
    if (p.on === true || p.planearAhora === true) await kickPiloto();
    return GET();
  }
  if (b?.pausaAuto && typeof b.pausaAuto === "object") {
    const a = b.pausaAuto;
    await commitMarketing((s) => {
      const cur = { ...DEFAULT_PAUSA, ...(s.pausaAuto ?? {}) };
      s.pausaAuto = {
        on: typeof a.on === "boolean" ? a.on : cur.on,
        cpaMax: a.cpaMax !== undefined ? Math.max(1, Math.min(500, Number(a.cpaMax) || cur.cpaMax)) : cur.cpaMax,
        gastoSinResultado: a.gastoSinResultado !== undefined ? Math.max(5, Math.min(1000, Number(a.gastoSinResultado) || cur.gastoSinResultado)) : cur.gastoSinResultado,
      };
    });
    return GET();
  }
  if (b?.capUsd !== undefined && !(Number(b.capUsd) >= 0 && Number(b.capUsd) <= 5000)) return bad("El tope diario debe ser entre US$0 y US$5.000.");
  if (b?.cuenta && (!/^\d{5,30}$/.test(String(b.cuenta.igUserId ?? "")) || String(b.cuenta.nombre ?? "").trim().length < 2)) return bad("La cuenta necesita un nombre y su número de Instagram (solo dígitos).");
  if (b?.evento !== undefined && !isEvento(b.evento)) return bad("Ese evento no existe.");
  await commitMarketing((s) => {
    if (isEvento(b?.evento)) s.evento = b.evento;
    if (b?.capUsd !== undefined) s.capUsd = Math.round(Number(b.capUsd) * 100) / 100;
    if (b?.cuenta) {
      const c = { id: `ig-${String(b.cuenta.igUserId)}`, nombre: String(b.cuenta.nombre).trim().slice(0, 60), igUserId: String(b.cuenta.igUserId), pageId: /^\d{5,30}$/.test(String(b.cuenta.pageId ?? "")) ? String(b.cuenta.pageId) : undefined };
      const old = s.cuentas.find((x) => x.igUserId === c.igUserId); // keep its character and autopilot settings
      s.cuentas = [...s.cuentas.filter((x) => x.igUserId !== c.igUserId), { ...old, ...c, pageId: c.pageId ?? old?.pageId }].slice(0, 20);
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
    if (typeof b?.idea === "string" && ["nueva", "usada", "descartada"].includes(b.estado)) {
      const i = (s.ideas ?? []).find((x) => x.id === b.idea);
      if (i) i.estado = b.estado;
    }
    if (b?.autoProd && typeof b.autoProd === "object") {
      const cur = { ...DEFAULT_AUTOPROD, ...(s.autoProd ?? {}) };
      const a = b.autoProd;
      s.autoProd = {
        on: typeof a.on === "boolean" ? a.on : cur.on,
        maxPorDia: a.maxPorDia !== undefined ? Math.max(0, Math.min(20, Math.round(Number(a.maxPorDia) || 0))) : cur.maxPorDia,
        modelo: typeof a.modelo === "string" ? (a.modelo === "" || videoProviders.some((p) => p.id === a.modelo) ? a.modelo : cur.modelo) : cur.modelo,
        sello: typeof a.sello === "boolean" ? a.sello : cur.sello,
      };
    }
    if (typeof b?.borrarIdea === "string") s.ideas = (s.ideas ?? []).filter((x) => x.id !== b.borrarIdea);
    if (typeof b?.pedido === "string" && ["pendiente", "en producción", "listo"].includes(b.estado)) {
      const p = s.pedidos.find((x) => x.id === b.pedido);
      if (p) p.estado = b.estado;
    }
  });
  return GET();
}

/** POST {probar: true}: checks every connection with Meta. POST {nuevaIdea: {texto, link?, imagen?: data URL}}: an idea for the content agents. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return no();
  const b = await req.json().catch(() => null);
  if (b?.nuevaIdea && typeof b.nuevaIdea === "object") {
    const texto = String(b.nuevaIdea.texto ?? "").trim();
    const link = String(b.nuevaIdea.link ?? "").trim();
    if (link && !/^https?:\/\/\S+$/.test(link)) return NextResponse.json({ error: "El link debe empezar con https://" }, { status: 400 });
    let imagen: { bytes: Uint8Array; type: string } | undefined;
    if (typeof b.nuevaIdea.imagen === "string" && b.nuevaIdea.imagen) {
      const m = b.nuevaIdea.imagen.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return NextResponse.json({ error: "La imagen debe ser JPG, PNG o WebP." }, { status: 400 });
      const bytes = Uint8Array.from(Buffer.from(m[2], "base64"));
      if (bytes.length > 3_500_000) return NextResponse.json({ error: "La imagen es muy pesada (máximo 3,5 MB)." }, { status: 400 });
      imagen = { bytes, type: m[1] };
    }
    if (!texto && !link && !imagen) return NextResponse.json({ error: "Escribe la idea, pega un link o sube una imagen." }, { status: 400 });
    const me = await currentUser();
    try { await addIdea({ texto, link: link || undefined, imagen }, me?.name?.trim() || me?.email.split("@")[0] || "equipo"); }
    catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo guardar la idea." }, { status: 502 }); }
    return GET();
  }
  // read-only technical diagnosis of the Meta connection (full error codes, never a token)
  if (b?.diagnostico) return NextResponse.json({ diagnostico: await diagnosticoMeta() });
  if (!b?.probar) return NextResponse.json({ error: "Nada que hacer." }, { status: 400 });
  return NextResponse.json({ prueba: await probarMeta() });
}
