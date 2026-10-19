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
import { fetchableUrl, saveMedia } from "@/lib/media";

export const maxDuration = 300;

interface ClipRow { id: string; idx: number; text: string; url: string | null; status: string; prompt: string }
export interface Review { clipId: string; url: string; idx: number; sim: number; heard: string; issues: string[]; severe: boolean; words: Word[]; dur: number; look?: string }

// Automatic review of every finished clip: listens to it (did it say the script?) and looks at it
// (same person, clothes and place as the others?). Severe problems are worth an automatic redo.
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
    const lang = settings.lang === "es-CL" ? "es" : "en";
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

    // 2) look at the stills together: obvious mismatches between clips
    if (textAI.configured() && clips.length > 1) {
      const urls: string[] = [];
      for (const c of clips) {
        const f = path.join(dir, `s${c.idx}.jpg`);
        const bytes = await readFile(f).catch(() => null);
        if (bytes) urls.push(await fetchableUrl(await saveMedia(s.user.workspace, "review", bytes, "image/jpeg"), s.user.workspace, 900));
      }
      const f = formatById(format);
      try {
        const look = parseJSON<{ cortes?: { corte: number; problema: string; grave: boolean }[] }>(
          await textAI.complete({
            json: true,
            images: urls,
            prompt: `Eres el editor de un anuncio en video hecho con IA (formato: ${f.name}). Las imágenes son una foto del medio de cada corte, en orden (imagen 1 = corte 1).
LO QUE DICE CADA CORTE:
${clips.map((c, i) => `CORTE ${i + 1}: "${c.text}"`).join("\n")}
${format === "ronda" ? "Es una RONDA: a propósito sale una persona distinta en cada corte. Revisa que el lugar, la hora del día y la luz sean el mismo ambiente." : f.speakers?.length === 2 ? "Aparecen dos personas: cada una debe verse igual (cara, pelo, ropa) en todos los cortes." : f.narr ? "Es voz en off: nadie debería hablar a cámara." : "Debe ser la MISMA persona, con la MISMA ropa, en todos los cortes."}
Busca SOLO errores OBVIOS que un espectador notaría: cara, pelo o ropa distinta a la del resto (cuando debería ser igual); manos o cuerpos deformes; texto, logos o números legibles en pantalla; algo que contradice lo que dice el corte; formato equivocado (por ejemplo una selfie cuando debería ser con camarógrafo).
"grave": true solo si vale la pena rehacer el corte.
Responde SOLO JSON: {"cortes":[{"corte":número,"problema":"en español, corto","grave":true}]} (lista vacía si no hay errores).`,
          }),
        );
        for (const x of look.cortes ?? []) {
          const r = results[Number(x.corte) - 1];
          if (!r || !x.problema) continue;
          r.look = x.problema;
          r.issues.push(`imagen: ${x.problema}`);
          if (x.grave) r.severe = true;
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
