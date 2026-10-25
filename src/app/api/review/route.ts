import { NextResponse } from "next/server";
import { freeRedoAvailable, grantFreeRedo } from "@/lib/credits";
import { FREE_REDOS } from "@/lib/credit-math";
import { tooMany } from "@/lib/rate";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { SESSION_ENDED, session } from "@/lib/access";
import { formatById } from "@/lib/formats";
import { learnFrom } from "@/lib/learn";
import { download, probe, still, workdir } from "@/lib/montage";
import { textAI } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";
import { elevenlabs } from "@/lib/providers/elevenlabs";
import { compare, type Word } from "@/lib/textmatch";
import { publicError } from "@/lib/public-error";
import { fetchableUrl, ownsMedia, saveMedia } from "@/lib/media";
import { sttLang } from "@/lib/ad-lang";
import { type LookFinding, applyLook, lookPrompt } from "@/lib/review-look";

export const maxDuration = 300;

interface ClipRow { id: string; idx: number; text: string; url: string | null; status: string; prompt: string }
export interface Review { clipId: string; url: string; idx: number; sim: number; heard: string; issues: string[]; severe: boolean; words: Word[]; dur: number; look?: string; redraw?: boolean }

// Automatic review of every finished clip: listens to it (did it say the script?) and looks at it
// (same person, clothes and place as the others? the customer's own product?). Severe problems are worth an
// automatic redo; a wrong product or a changed outfit also gets its first frame drawn again («redraw»).
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;  // (no credit check: the quality review and its free redos are part of what was already paid)
  const { db } = s;
  const b = await req.json().catch(() => null);
  const adId = String(b?.adId ?? "");
  try {
    const ad = await db.get("ads", adId);
    if (!ad) return NextResponse.json({ error: "Anuncio no encontrado." }, { status: 404 });
    const clips = ((await db.list("clips", `ad_id=eq.${adId}&order=idx.asc`)) as unknown as ClipRow[]).filter((c) => c.status === "done" && c.url);
    if (!clips.length) return NextResponse.json({ error: "Todavía no hay cortes listos." }, { status: 400 });
    const settings = (ad.settings ?? {}) as Record<string, unknown>;
    const lang = sttLang(typeof settings.lang === "string" ? settings.lang : "en"); // es-CL and es → "es"
    const format = String(ad.format || "ugc");
    const dir = await workdir(adId);

    // 1) listen + grab a still of each clip, in parallel
    const results: Review[] = await Promise.all(
      clips.map(async (c) => {
        const file = path.join(dir, `c${c.idx}.mp4`);
        const src = await fetchableUrl(c.url!, s.user.workspace);
        await download(src, file);
        const { dur } = await probe(file);
        await still(file, Math.max(0.3, dur * 0.5), path.join(dir, `s${c.idx}.jpg`)).catch(() => {});
        const t = elevenlabs.configured() ? await elevenlabs.transcribe!(src, lang).catch(() => null) : null;
        const narr = formatById(format).narr;
        const q = t ? compare(c.text, t.words, lang, dur) : { sim: 0, heard: "", issues: ["no se pudo escuchar el corte"], severe: false };
        // voice-over formats: nobody should speak on camera, so the words don't have to match
        if (narr) { q.issues = []; q.severe = false; }
        return { clipId: c.id, url: c.url!, idx: c.idx, ...q, words: t?.words ?? [], dur };
      }),
    );

    // 2) look at the stills together: obvious mismatches between clips, the same person and clothes from one
    // cut to the next, and (when the customer gave its photo) the same product in every cut
    const productRef = (settings.product as { image_url?: unknown } | null)?.image_url;
    const hasProduct = typeof productRef === "string" && ownsMedia(productRef, s.user.workspace);
    if (textAI.configured() && (clips.length > 1 || hasProduct)) {
      const urls: string[] = [];
      const shown: Review[] = []; // the cut behind each image (a still that couldn't be taken is skipped)
      for (const [i, c] of clips.entries()) {
        const bytes = await readFile(path.join(dir, `s${c.idx}.jpg`)).catch(() => null);
        if (!bytes) continue;
        urls.push(await fetchableUrl(await saveMedia(s.user.workspace, "review", bytes, "image/jpeg"), s.user.workspace, 900));
        shown.push(results[i]);
      }
      const f = formatById(format);
      try {
        const withProduct = hasProduct && shown.length > 0;
        // the product photo goes LAST, so image N is still cut N
        if (withProduct) urls.push(await fetchableUrl(productRef, s.user.workspace, 900));
        if (shown.length > 1 || withProduct) {
          const look = parseJSON<{ cortes?: LookFinding[] }>(
            await textAI.complete({
              json: true,
              images: urls,
              prompt: lookPrompt({ formatName: f.name, format, twoPeople: f.speakers?.length === 2, narr: Boolean(f.narr), texts: shown.map((r) => clips.find((c) => c.id === r.clipId)?.text ?? ""), hasProduct: withProduct }),
            }),
          );
          applyLook(shown, look.cortes ?? [], { hasProduct: withProduct, format, personaFromFirst: Boolean(settings.persona) });
        }
      } catch { /* the visual check is a bonus; the audio check already ran */ }
    }

    // 3) remember: problems become rules for every future prompt
    const severeIssues = results.filter((r) => r.severe).flatMap((r) => r.issues);
    const learned = await learnFrom(severeIssues, format, s.user.workspace === "main").catch(() => 0);

    await db.update("ads", adId, { settings: { ...settings, review: results, reviewedAt: new Date().toISOString() } });
    // severe errors earn a free automatic redo (granted here, server-side: max 1 per clip, 2 per ad)
    const freeRedo: Record<string, boolean> = {};
    for (const r of results) {
      if (!r.severe || !FREE_REDOS) continue;
      await grantFreeRedo(s.user.workspace, adId, r.clipId);
      freeRedo[r.clipId] = await freeRedoAvailable(s.user.workspace, adId, r.clipId);
    }
    for (const r of results) await db.update("clips", r.clipId, { error: r.issues.length ? r.issues.join(" · ").slice(0, 500) : null }).catch(() => {});
    return NextResponse.json({ results: results.map(({ words, ...r }) => ({ ...r, words: words.length, freeRedo: Boolean(freeRedo[r.clipId]) })), learned });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo revisar.") }, { status: 502 });
  }
}
