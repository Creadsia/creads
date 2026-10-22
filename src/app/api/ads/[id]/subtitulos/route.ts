import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { type ApiAd, listAds, loadAd, saveAd, studioAs } from "@/lib/api-ads";
import { type Correccion, cleanFixes } from "@/lib/montage";
import { DemoInputError, runDemo } from "@/lib/demo-run";
import { fetchableUrl, ownsMedia } from "@/lib/media";
import { publicError } from "@/lib/public-error";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// «Editar subtítulos» from «Anuncios terminados», for any finished video ad (Manual, Automático or a demo).
// GET → the subtitle lines to edit. POST {cambios: [{de, a}]} → the same video built again with the words on
// screen corrected: free, 1–3 minutes, nothing generated again (same clips, voice, presenter and headlines).

type Settings = { srt?: string; captions?: unknown; pro?: unknown; look?: { plantilla?: string; c1?: string; sonidos?: boolean }; correcciones?: Correccion[]; demo?: boolean; api?: string };
type AdRow = { id: string; final_url: string | null; status: string; format: string | null; settings: Settings | null };

/** The Automático/API job behind a library ad, if any (a demo needs it to be built again). */
async function jobOf(ws: string, row: AdRow): Promise<ApiAd | null> {
  if (row.settings?.api) return loadAd(ws, row.settings.api);
  const all = await listAds(ws).catch(() => [] as ApiAd[]);
  return all.find((j) => (row.final_url && j.videoUrl === row.final_url) || j.adId === row.id) ?? null;
}

async function load(req: Request, id: string) {
  const s = await session(req);
  if (!s) return { error: NextResponse.json({ error: SESSION_ENDED }, { status: 401 }) };
  const row = (await s.db.get("ads", id).catch(() => null)) as AdRow | null;
  if (!row || !row.final_url) return { error: NextResponse.json({ error: "No encontré ese anuncio terminado." }, { status: 404 }) };
  return { s, row };
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await load(req, (await ctx.params).id);
  if ("error" in r) return r.error;
  const { s, row } = r;
  const st = row.settings ?? {};
  let srt = "";
  if (st.srt && ownsMedia(st.srt, s.user.workspace)) {
    const res = await fetch(await fetchableUrl(st.srt, s.user.workspace, 300), { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (res?.ok) srt = (await res.text()).slice(0, 60_000);
  }
  // lines when the montage kept them; otherwise «word → word» (demos, older ads)
  const modo = srt ? "lineas" : st.demo || st.captions !== null ? "palabras" : "sin";
  return NextResponse.json({ modo, srt, correcciones: st.correcciones ?? [] });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const r = await load(req, (await ctx.params).id);
  if ("error" in r) return r.error;
  const { s, row } = r;
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  const ws = s.user.workspace;
  const st = row.settings ?? {};
  const cambios = cleanFixes((await req.json().catch(() => null))?.cambios);
  if (!cambios.length) return NextResponse.json({ error: "No hay cambios que guardar." }, { status: 400 });
  try {
    if (st.demo) {
      const job = await jobOf(ws, row);
      if (!job?.demo) return NextResponse.json({ error: "Esta demo se armó antes de que existiera esta opción: pídele a Automático que la arme de nuevo y después corriges sus subtítulos." }, { status: 409 });
      const prev = job.demo.correcciones ?? [];
      const params = { ...job.demo, correcciones: [...prev.filter((c) => !cambios.some((x) => x.de.toLowerCase() === c.de.toLowerCase())), ...cambios].slice(-15) };
      const url = (await runDemo(ws, params)).url;
      await saveAd({ ...job, videoUrl: url, demo: params, updatedAt: new Date().toISOString() });
      await s.db.update("ads", row.id, { final_url: url, settings: { ...st, correcciones: params.correcciones, api: job.id } });
      return NextResponse.json({ url, correcciones: params.correcciones });
    }
    if (st.captions === null) return NextResponse.json({ error: "Este anuncio se armó sin subtítulos." }, { status: 409 });
    const job = await jobOf(ws, row);
    const prev = st.correcciones ?? job?.correcciones ?? [];
    const merged = [...prev.filter((c) => !cambios.some((x) => x.de.toLowerCase() === c.de.toLowerCase())), ...cambios].slice(-15);
    const look = st.look ? { plantilla: st.look.plantilla, c1: st.look.c1, sonidos: st.look.sonidos } : undefined;
    const d = await studioAs(req)<{ url: string }>("/api/montage", { adId: row.id, captions: true, style: st.captions, pro: Boolean(st.pro), mismoPlan: true, ...(look ? { look } : {}), correcciones: merged }, 290_000);
    // Automático's copy of the same ad shows the corrected video too
    if (job && job.adId === row.id) await saveAd({ ...job, videoUrl: d.url, correcciones: merged, updatedAt: new Date().toISOString() }).catch(() => null);
    return NextResponse.json({ url: d.url, correcciones: merged });
  } catch (err) {
    if (err instanceof DemoInputError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("ads subtitulos", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: publicError(err, "No se pudo volver a armar el video. Intenta de nuevo en un momento.") }, { status: 502 });
  }
}
