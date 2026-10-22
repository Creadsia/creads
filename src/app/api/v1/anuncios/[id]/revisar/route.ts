import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { session, SESSION_ENDED } from "@/lib/access";
import { loadAd } from "@/lib/api-ads";
import { tooMany } from "@/lib/rate";
import { download, ff, probe, workdir } from "@/lib/montage";
import { fetchableUrl, saveMedia } from "@/lib/media";
import { elevenlabs } from "@/lib/providers/elevenlabs";
import { compare } from "@/lib/textmatch";
import { mediaRef } from "@/lib/mcp";
import { publicError } from "@/lib/public-error";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

// GET: looks at and listens to a finished ad, the way the owner's reviews are done (21 Oct 2026): a contact
// sheet of 8 frames across the whole video (same face, clothes and place?) and the transcript of the final
// audio against the script (every word said, nothing cut?). Free: it only reads the ad.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  const ws = s.user.workspace;
  const job = await loadAd(ws, (await ctx.params).id);
  if (!job) return NextResponse.json({ error: "No encontré ese anuncio." }, { status: 404 });
  if (job.estado !== "listo" || !job.videoUrl) return NextResponse.json({ error: "El anuncio todavía no está listo." }, { status: 409 });
  try {
    const ref = mediaRef(job.videoUrl);
    const src = await fetchableUrl(ref, ws);
    const dir = await workdir(`rev-${job.id}`);
    const file = path.join(dir, "ad.mp4");
    await download(src, file);
    const { dur } = await probe(file);
    // 8 frames spread over the video, in a 4×2 sheet (each 270 px wide)
    const n = 8;
    const step = Math.max(0.5, (dur - 0.4) / n);
    const sheet = path.join(dir, "sheet.jpg");
    await ff(["-y", "-v", "error", "-i", file, "-vf", `fps=1/${step.toFixed(3)},scale=270:-2,tile=4x2:padding=6:color=black`, "-frames:v", "1", "-q:v", "4", sheet], 90_000);
    const hoja = await saveMedia(ws, "review", await readFile(sheet), "image/jpeg");
    const lang = job.idioma === "en" ? "en" : "es";
    const t = elevenlabs.configured() ? await elevenlabs.transcribe!(src, lang).catch(() => null) : null;
    const q = t ? compare(job.guion, t.words, lang, dur) : null;
    return NextResponse.json({
      revision: {
        id: job.id,
        duracion: Math.round(dur * 10) / 10,
        hoja, // contact sheet: 8 frames, in order, left to right and top to bottom
        escuchado: q?.heard ?? null,
        parecido: q ? Math.round(q.sim * 100) : null, // % of the script heard in the final audio
        observaciones: q?.issues ?? ["No se pudo escuchar el audio."],
      },
    });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo revisar el anuncio.") }, { status: 502 });
  }
}
