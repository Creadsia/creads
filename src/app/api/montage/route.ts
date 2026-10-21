import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import path from "node:path";
import { SESSION_ENDED, session } from "@/lib/access";
import { formatById } from "@/lib/formats";
import { normalizeStyle } from "@/lib/caption-style";
import { type BuildClip, build, captions, ff, respell, download, frameSize, probe, segLen, selfCheck, trimPoints, workdir } from "@/lib/montage";
import { elevenlabs } from "@/lib/providers/elevenlabs";
import { fetchableUrl, saveMedia } from "@/lib/media";
import { publicError } from "@/lib/public-error";
import type { Word } from "@/lib/textmatch";
import { cutTimes, cleanPlan, proPass, proPrompt, type ProPlan } from "@/lib/pro-edit";
import { textAI } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";

export const maxDuration = 300;

interface ClipRow { id: string; idx: number; url: string | null; status: string; text: string | null }

// GET: is the montage engine working on this server? (no data, no auth needed)
export async function GET() {
  return NextResponse.json(await selfCheck());
}

// Builds the finished ad: trims, joins and captions every clip, then saves it to the library.
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("heavy", s.user.id);
  if (limited) return limited;
  const { db } = s;
  const b = await req.json().catch(() => null);
  const adId = String(b?.adId ?? "");
  const withCaptions = b?.captions !== false;
  const style = normalizeStyle(b?.style);
  // «Edición Pro»: headlines, zooms, flashes, sounds and a closing card on top of the montage
  const pro = b?.pro === true;
  const str = (v: unknown, n: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "");
  const cierreHint = { titulo: str(b?.cierre?.titulo, 28), linea: str(b?.cierre?.linea, 48), notas: str(b?.indicaciones, 600), estilo: str(b?.estilo, 20) };
  try {
    const ad = await db.get("ads", adId);
    if (!ad) return NextResponse.json({ error: "Anuncio no encontrado." }, { status: 404 });
    const clips = (await db.list("clips", `ad_id=eq.${adId}&order=idx.asc`)) as unknown as ClipRow[];
    if (!clips.length || clips.some((c) => c.status !== "done" || !c.url)) return NextResponse.json({ error: "Espera a que todos los cortes estén listos." }, { status: 400 });
    const settings = (ad.settings ?? {}) as { lang?: string; review?: { clipId: string; url?: string; words: Word[] }[] };
    const lang = settings.lang === "es-CL" ? "es" : "en";
    const aspect = String(ad.aspect || "9:16");
    const dir = await workdir(adId);

    const prepared = await Promise.all(
      clips.map(async (c) => {
        const file = path.join(dir, `c${c.idx}.mp4`);
        const src = await fetchableUrl(c.url!, s.user.workspace);
        await download(src, file);
        const p = await probe(file);
        const t = p.audio ? await trimPoints(file, p.dur) : { a: 0, b: p.dur };
        // reuse the review's transcript only if the clip wasn't redone since
        let words = settings.review?.find((r) => r.clipId === c.id && r.url === c.url)?.words;
        if (!words?.length && withCaptions && elevenlabs.configured() && !formatById(String(ad.format)).narr) {
          words = (await elevenlabs.transcribe!(src, lang).catch(() => null))?.words;
        }
        // spell the words as in the script when they line up (fixes what the transcription misheard)
        if (words?.length && style.script && c.text) words = respell(words, c.text);
        return { clip: { file, a: t.a, b: t.b, audio: p.audio } as BuildClip, words: words ?? [] };
      }),
    );

    // Word timings on the final timeline (after trimming and joining).
    let offset = 0;
    const timeline: Word[] = [];
    for (const p of prepared) {
      for (const w of p.words) if (w.s >= p.clip.a - 0.05 && w.e <= p.clip.b + 0.3) timeline.push({ w: w.w, s: Math.max(0, w.s - p.clip.a) + offset, e: Math.max(0, Math.min(w.e, p.clip.b) - p.clip.a) + offset });
      offset += segLen(p.clip);
    }
    const [W, H] = frameSize(aspect);
    // captions, and/or the «Hecho con Creads IA» badge (also without captions)
    const cap = (withCaptions && timeline.length) || style.sello ? captions(withCaptions ? timeline : [], W, H, aspect, style, offset) : null;
    let bytes = await build(dir, prepared.map((p) => p.clip), aspect, cap?.ass ?? null);
    let duration = offset;
    let proPlan: ProPlan | null = null;
    if (pro) {
      const script = clips.map((c) => c.text ?? "").join(" ").trim();
      const fallback = { titulo: cierreHint.titulo || (lang === "es" ? "¡Pruébalo hoy!" : "Try it today!"), linea: cierreHint.linea || "" };
      let raw: unknown = null;
      if (textAI.configured() && script) {
        raw = await textAI.complete({ prompt: proPrompt(script, timeline, lang, cierreHint), json: true, maxTokens: 900 })
          .then((t) => parseJSON(t)).catch(() => null);
      }
      proPlan = cleanPlan(raw, offset, fallback);
      if (cierreHint.titulo) proPlan.cierre.titulo = cierreHint.titulo;
      if (cierreHint.linea) proPlan.cierre.linea = cierreHint.linea;
      // a failed Pro pass never loses the ad: the plain montage (cuts + captions) is delivered instead
      const r = await proPass(ff, dir, path.join(dir, "final.mp4"), W, H, offset, cutTimes(prepared.map((p) => segLen(p.clip))), proPlan)
        .catch((e) => { console.error("montage pro", e instanceof Error ? e.message : e); return null; });
      if (r) { bytes = r.bytes; duration = r.seconds; } else proPlan = null;
    }

    const stamp = Date.now();
    const ws = s.user.workspace;
    const url = await saveMedia(ws, "finals", bytes, "video/mp4", `${adId}-${stamp}.mp4`);
    const srtUrl = cap && cap.cues ? await saveMedia(ws, "finals", new TextEncoder().encode(cap.srt), "text/plain", `${adId}-${stamp}.srt`) : null;
    const row = await db.update("ads", adId, { final_url: url, status: "done", settings: { ...(ad.settings as object), srt: srtUrl, duration: Math.round(duration * 10) / 10, captions: cap && cap.cues ? style : null, pro: proPlan } });
    return NextResponse.json({ ad: row, url, srt: srtUrl, duration, pro: proPlan });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo armar el anuncio.") }, { status: 502 });
  }
}
