import { NextResponse } from "next/server";
import path from "node:path";
import { checkAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { formatById } from "@/lib/formats";
import { type BuildClip, build, captions, download, frameSize, probe, selfCheck, trimPoints, workdir } from "@/lib/montage";
import { elevenlabs } from "@/lib/providers/elevenlabs";
import { uploadMedia } from "@/lib/supabase";
import type { Word } from "@/lib/textmatch";

export const maxDuration = 300;

interface ClipRow { id: string; idx: number; url: string | null; status: string }

// GET: is the montage engine working on this server? (no data, no auth needed)
export async function GET() {
  return NextResponse.json(await selfCheck());
}

// Builds the finished ad: trims, joins and captions every clip, then saves it to the library.
export async function POST(req: Request) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const b = await req.json().catch(() => null);
  const adId = String(b?.adId ?? "");
  const withCaptions = b?.captions !== false;
  const preset = [1, 2, 3, 4].includes(Number(b?.style?.preset)) ? (Number(b.style.preset) as 1 | 2 | 3 | 4) : 2;
  const size = Math.min(140, Math.max(60, Number(b?.style?.size) || 96));
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
        await download(c.url!, file);
        const p = await probe(file);
        const t = p.audio ? await trimPoints(file, p.dur) : { a: 0, b: p.dur };
        // reuse the review's transcript only if the clip wasn't redone since
        let words = settings.review?.find((r) => r.clipId === c.id && r.url === c.url)?.words;
        if (!words?.length && withCaptions && elevenlabs.configured() && !formatById(String(ad.format)).narr) {
          words = (await elevenlabs.transcribe!(c.url!, lang).catch(() => null))?.words;
        }
        return { clip: { file, a: t.a, b: t.b, audio: p.audio } as BuildClip, words: words ?? [] };
      }),
    );

    // Word timings on the final timeline (after trimming and joining).
    let offset = 0;
    const timeline: Word[] = [];
    for (const p of prepared) {
      for (const w of p.words) if (w.s >= p.clip.a - 0.05 && w.e <= p.clip.b + 0.3) timeline.push({ w: w.w, s: Math.max(0, w.s - p.clip.a) + offset, e: Math.max(0, Math.min(w.e, p.clip.b) - p.clip.a) + offset });
      offset += p.clip.b - p.clip.a;
    }
    const [W, H] = frameSize(aspect);
    const cap = withCaptions && timeline.length ? captions(timeline, W, H, aspect, { preset, size }) : null;
    const bytes = await build(dir, prepared.map((p) => p.clip), aspect, cap?.ass ?? null);

    const stamp = Date.now();
    const url = await uploadMedia(`finals/${adId}-${stamp}.mp4`, bytes, "video/mp4");
    const srtUrl = cap ? await uploadMedia(`finals/${adId}-${stamp}.srt`, new TextEncoder().encode(cap.srt), "text/plain") : null;
    const row = await db.update("ads", adId, { final_url: url, status: "done", settings: { ...(ad.settings as object), srt: srtUrl, duration: Math.round(offset * 10) / 10, captions: cap ? { preset, size } : null } });
    return NextResponse.json({ ad: row, url, srt: srtUrl, duration: offset });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo armar el anuncio." }, { status: 502 });
  }
}
