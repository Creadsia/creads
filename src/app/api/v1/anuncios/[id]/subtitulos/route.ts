import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { loadAd, publicAd, saveAd, studioAs } from "@/lib/api-ads";
import { montageBody } from "@/lib/ad-runner";
import { cleanFixes } from "@/lib/montage";
import { DemoInputError, runDemo } from "@/lib/demo-run";
import { publicError } from "@/lib/public-error";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST {cambios: [{de, a}]} → the finished ad built again with its subtitles corrected («CREATZIA.COM» →
// «creadsia.com»). Free and in 1–3 minutes: the clips, the voice and the presenter are the same; only the
// words on screen change. Corrections add up (earlier ones are kept). Same ad id, new video.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  const ws = s.user.workspace;
  const job = await loadAd(ws, (await ctx.params).id);
  if (!job) return NextResponse.json({ error: "No encontré ese anuncio." }, { status: 404 });
  if (job.estado !== "listo") return NextResponse.json({ error: "El anuncio todavía no está listo." }, { status: 409 });
  const cambios = cleanFixes((await req.json().catch(() => null))?.cambios);
  if (!cambios.length) return NextResponse.json({ error: "Dime qué palabra cambiar: cambios: [{ de: «CREATZIA.COM», a: «creadsia.com» }]." }, { status: 400 });
  const merged = [...(job.correcciones ?? job.demo?.correcciones ?? []).filter((c) => !cambios.some((x) => x.de.toLowerCase() === c.de.toLowerCase())), ...cambios].slice(-15);
  try {
    let videoUrl: string;
    if (job.formato === "demo") {
      if (!job.demo) return NextResponse.json({ error: "Esta demo se armó antes de que existiera esta opción: ármala de nuevo y después corrige sus subtítulos." }, { status: 409 });
      const params = { ...job.demo, correcciones: merged };
      videoUrl = (await runDemo(ws, params)).url;
      await saveAd({ ...job, videoUrl, demo: params, updatedAt: new Date().toISOString() });
      // the copy in «Anuncios terminados» shows the corrected video too
      const rows = (await s.db.list("ads", `final_url=eq.${encodeURIComponent(job.videoUrl ?? "")}&limit=1`).catch(() => [])) as { id: string }[];
      if (rows[0]) await s.db.update("ads", rows[0].id, { final_url: videoUrl }).catch(() => null);
    } else {
      if (!job.adId) return NextResponse.json({ error: "Este anuncio no se puede volver a armar." }, { status: 409 });
      const d = await studioAs(req)<{ url: string }>("/api/montage", montageBody({ ...job, correcciones: merged }, job.sello), 290_000);
      videoUrl = d.url;
      await saveAd({ ...job, videoUrl, correcciones: merged, updatedAt: new Date().toISOString() });
    }
    return NextResponse.json({ anuncio: publicAd({ ...job, videoUrl }), correcciones: merged });
  } catch (err) {
    if (err instanceof DemoInputError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("subtitulos", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: publicError(err, "No se pudo volver a armar el video. Intenta de nuevo en un momento.") }, { status: 502 });
  }
}
