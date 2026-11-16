import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { isOwner } from "@/lib/auth";
import { loadMarketing, publishVideoUrl } from "@/lib/marketing";
import { metaConn } from "@/lib/meta-conexiones";
import { fetchableUrl, ownsMedia } from "@/lib/media";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Publica un video como Reel en la cuenta de Instagram de la marca (solo el dueño). Lo usa la herramienta
// MCP «creads_publicar_reel», así que Claude puede publicar directo. El video puede ser una URL pública o un
// archivo de la cuenta Creads (se convierte a link público que Meta pueda descargar).

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  if (!isOwner(s.user)) return NextResponse.json({ error: "Solo el dueño puede publicar en las cuentas de la marca." }, { status: 403 });

  const b = (await req.json().catch(() => null)) as { video?: string; caption?: string; cuenta?: string } | null;
  let video = String(b?.video ?? "").trim();
  const caption = String(b?.caption ?? "").slice(0, 2200);
  if (!video) return NextResponse.json({ ok: false, error: "Falta el video." });

  // La cuenta de Instagram: la pedida (por nombre o id), o la primera de la marca, o la conectada en Meta.
  const m = await loadMarketing().catch(() => null);
  const cuentas = m?.cuentas ?? [];
  const ref = String(b?.cuenta ?? "").trim().toLowerCase();
  let igUserId = "";
  if (ref) {
    const hit = cuentas.find((c) => c.igUserId === ref || c.id.toLowerCase() === ref || c.nombre.toLowerCase().includes(ref));
    igUserId = hit?.igUserId ?? (/^\d{5,25}$/.test(ref) ? ref : "");
  } else {
    igUserId = cuentas[0]?.igUserId ?? "";
  }
  if (!igUserId) igUserId = (await metaConn().catch(() => null))?.igUserId ?? "";
  if (!/^\d{5,25}$/.test(igUserId)) return NextResponse.json({ ok: false, error: "No hay cuenta de Instagram conectada (conéctala en Marketing → Conexiones con Meta, o agrégala en Cuentas de Instagram de la marca)." });

  // Si el video es un archivo de esta cuenta Creads, pasarlo a un link público (1 h) que Meta pueda bajar.
  if (ownsMedia(video, s.user.workspace)) video = await fetchableUrl(video, s.user.workspace, 3600).catch(() => video);
  if (!/^https:\/\/\S+$/i.test(video)) return NextResponse.json({ ok: false, error: "El video debe ser una URL https pública o un archivo de tu cuenta Creads." });

  try {
    const mediaId = await publishVideoUrl(igUserId, video, caption);
    return NextResponse.json({ ok: true, mediaId, ensayo: mediaId === null, igUserId });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "No se pudo publicar." });
  }
}
