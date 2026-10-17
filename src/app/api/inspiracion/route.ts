import { NextResponse } from "next/server";
import { fullSession } from "@/lib/access";
import { isOwner } from "@/lib/auth";
import { addExample, cleanExample, listExamples, removeExample } from "@/lib/inspiracion";
import { fetchableUrl, ownsMedia, workspaceOf } from "@/lib/media";
import { probe } from "@/lib/montage";
import { publicError } from "@/lib/public-error";

// GET: the example gallery (with short-lived links to play each video).
// POST / DELETE: Creadsia adds or removes examples (owner only).

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function GET(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  try {
    const list = await listExamples();
    const rows = await Promise.all(list.map(async (e) => {
      const ws = workspaceOf(e.video);
      const play = ws ? await fetchableUrl(e.video, ws, 6 * 3600).catch(() => null) : null;
      return play ? { id: e.id, title: e.title, tag: e.tag, prompt: e.prompt, mode: e.mode, secs: e.secs, play } : null;
    }));
    return NextResponse.json({ rows: rows.filter(Boolean), canEdit: isOwner(s.user) });
  } catch (err) {
    return bad(publicError(err, "No se pudo cargar la inspiración."), 502);
  }
}

export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  if (!isOwner(s.user)) return bad("No autorizado.", 403);
  const b = (await req.json().catch(() => null)) ?? {};
  if (!ownsMedia(b.video, s.user.workspace)) return bad("Sube el video del ejemplo.");
  const e = cleanExample(b);
  if (e.title.length < 2) return bad("Ponle un título.");
  try {
    const secs = (await probe(await fetchableUrl(b.video, s.user.workspace))).dur;
    if (!secs) return bad("No pude medir el largo del video. Prueba con un MP4.");
    if (secs > 30.5) return bad(`El ejemplo debe durar 30 segundos o menos (este dura ${Math.round(secs)} s).`);
    return NextResponse.json({ row: await addExample({ ...e, video: b.video, secs }) });
  } catch (err) {
    return bad(publicError(err, "No se pudo guardar el ejemplo."), 502);
  }
}

export async function DELETE(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  if (!isOwner(s.user)) return bad("No autorizado.", 403);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  try {
    await removeExample(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return bad(publicError(err, "No se pudo quitar el ejemplo."), 502);
  }
}
