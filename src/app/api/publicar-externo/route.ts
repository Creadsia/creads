import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { loadMarketing, publishVideoUrl } from "@/lib/marketing";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Publishes a Reel from a video made OUTSIDE Creads (the office's video agent «Vale»): the office POSTs the
// approved video's public https URL here and Creads publishes it with the brand's Instagram connection, so the
// Meta token never leaves Creads. The human gate is the approval in the office BEFORE this is called.
// Server-to-server only (CRON_SECRET).
const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.byteLength === y.byteLength && timingSafeEqual(x, y); };

export async function POST(req: Request) {
  const secret = (process.env.CREADS_PUBLISH_SECRET || process.env.CRON_SECRET || "").trim();
  if (secret.length < 16 || !same(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  let body: { videoUrl?: string; caption?: string; igUserId?: string };
  try { body = (await req.json()) as typeof body; } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }

  const videoUrl = String(body.videoUrl ?? "").trim();
  const caption = String(body.caption ?? "").slice(0, 2200);
  if (!/^https:\/\/\S+$/i.test(videoUrl)) return NextResponse.json({ error: "Falta videoUrl (una URL https pública que Meta pueda descargar)." }, { status: 400 });

  // The Instagram account to publish as: the one given, or the brand's first account in Marketing.
  let igUserId = String(body.igUserId ?? "").trim();
  if (!igUserId) {
    const m = await loadMarketing().catch(() => null);
    igUserId = m?.cuentas?.[0]?.igUserId ?? "";
  }
  if (!/^\d{5,25}$/.test(igUserId)) return NextResponse.json({ error: "No hay cuenta de Instagram para publicar (agrega una en Marketing → Cuentas de Instagram de la marca)." }, { status: 400 });

  try {
    const mediaId = await publishVideoUrl(igUserId, videoUrl, caption);
    return NextResponse.json({ ok: true, mediaId, ensayo: mediaId === null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "No se pudo publicar." }, { status: 500 });
  }
}
