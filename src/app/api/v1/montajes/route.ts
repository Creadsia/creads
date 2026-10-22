import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { publicAd, saveFinishedAd } from "@/lib/api-ads";
import { cleanFixes } from "@/lib/montage";
import { publicError } from "@/lib/public-error";
import { type DemoParams, DemoInputError, runDemo } from "@/lib/demo-run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST {presentador: ad_…, ejemplos: [ad_…] (2–6), producto?: image link, prompt?: text, titulo?, cierre?, linea?, correcciones?}
// → «Demo con presentador»: the presenter's ad with the example ads in split screen / full screen, the
// «producto + prompt» card, word-by-word captions and a closing card. All the ads must be this account's and
// «listo». Free: the clips were paid when they were made. Answers with a new ad, already «listo».
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  const ws = s.user.workspace;
  const b = (await req.json().catch(() => null)) ?? {};
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");
  const params: DemoParams = {
    presentador: str(b.presentador, 30),
    ejemplos: Array.isArray(b.ejemplos) ? b.ejemplos.filter((x: unknown) => typeof x === "string").slice(0, 6) : [],
    producto: str(b.producto, 600) || null, prompt: str(b.prompt, 160), cierre: str(b.cierre, 28), linea: str(b.linea, 48),
    correcciones: cleanFixes(b.correcciones),
  };
  try {
    const r = await runDemo(ws, params);
    const titulo = (str(b.titulo, 120) || `Demo · ${r.host.titulo}`).slice(0, 120);
    const job = await saveFinishedAd(ws, s.user.id, { titulo: titulo.slice(0, 80), guion: r.host.guion, idioma: r.host.idioma, videoUrl: r.url, formato: "demo", demo: params });
    // also in the studio's «Anuncios terminados», linked to its job so its subtitles can be edited there
    // (a missing table never loses the video)
    await s.db.insert("ads", { title: titulo, format: "ugc", aspect: "9:16", status: "done", final_url: r.url, settings: { demo: true, api: job.id } }).catch((e: unknown) => console.error("montajes ads row", e instanceof Error ? e.message : e));
    return NextResponse.json({ anuncio: publicAd(job), segundos: Math.round(r.seconds * 10) / 10 });
  } catch (err) {
    if (err instanceof DemoInputError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("montajes", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: publicError(err, "No se pudo armar el video. Intenta de nuevo en un momento.") }, { status: 502 });
  }
}
