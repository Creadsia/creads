import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { ownsMedia } from "@/lib/media";
import { publicError } from "@/lib/public-error";

export const dynamic = "force-dynamic";

// Adds an uploaded (external) video to an ad as a new clip, so it shows up in the editor's
// «Clips de tu anuncio» and is included when the editor exports. The file must already be in this
// workspace's storage (uploaded via /api/upload). No AI and no credits: it's just a clip of the ad.

interface ClipRow { id: string; idx: number }

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("upload", s.user.id);
  if (limited) return limited;
  const id = (await ctx.params).id;
  const ws = s.user.workspace;
  try {
    const ad = await s.db.get("ads", id).catch(() => null);
    if (!ad) return NextResponse.json({ error: "No encontré ese anuncio." }, { status: 404 });
    const b = await req.json().catch(() => null);
    const url = b?.url;
    // the video must be a file already uploaded to this customer's own storage
    if (!ownsMedia(url, ws)) return NextResponse.json({ error: "Ese video no es válido o no es tuyo." }, { status: 400 });
    const nombre = typeof b?.nombre === "string" ? b.nombre.slice(0, 80) : "";
    const clips = (await s.db.list("clips", `ad_id=eq.${id}&order=idx.asc`).catch(() => [])) as unknown as ClipRow[];
    if (clips.length >= 40) return NextResponse.json({ error: "Este anuncio ya tiene demasiados clips." }, { status: 400 });
    const idx = clips.reduce((m, c) => Math.max(m, c.idx ?? 0), -1) + 1;
    const row = (await s.db.insert("clips", { ad_id: id, idx, kind: "upload", text: nombre, status: "done", url })) as { id: string; idx: number };
    return NextResponse.json({ id: row.id, idx: row.idx, url, texto: nombre });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo agregar el video.") }, { status: 502 });
  }
}
