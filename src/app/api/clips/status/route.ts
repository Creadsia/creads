import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { SESSION_ENDED, session } from "@/lib/access";
import { findVideo } from "@/lib/providers";
import { mediaRefOf, mediaSaved, saveMedia } from "@/lib/media";
import { explainFailure, serviceOfModel } from "@/lib/balances";
import { chargedSince, refundJob } from "@/lib/credits";
import { isOwner } from "@/lib/auth";
import { fetchableUrl } from "@/lib/media";
import { falPoll, falSubmit } from "@/lib/providers/fal";
import { elevenlabs } from "@/lib/providers/elevenlabs";
import { type StorySettings, voiceLang } from "@/lib/historias";
import { customerText, publicError } from "@/lib/public-error";
import { canUseVoice } from "@/lib/voices";

const LIPSYNC = "fal-ai/kling-video/lipsync/audio-to-video";
const LIPSYNC_PRO = "fal-ai/sync-lipsync/v2"; // with model "lipsync-2-pro": the most natural mouth

/** Story shots whose speaker has their own voice: after the animation, the line is recorded with that
 * voice and lip-synced onto the clip (a second job, "ls:<fal job>"). */
// What was paid for is pinned on the clip when it starts ("shot:ls:<voice>" + its line), so later edits to
// the story can't add or drop a lip-sync nobody paid for.
async function voiceFor(db: { get: (t: "ads", id: string) => Promise<Record<string, unknown> | null> }, clip: Record<string, unknown>, ws: string) {
  const kind = String(clip.kind ?? "");
  // story shots ("shot:ls:<voice>") and ad cuts ("ad:ls:<voice>") that speak with a chosen voice
  const m = /^(?:shot|ad):(lsp?):(.+)$/.exec(kind);
  if (!m) return null;
  const pro = m[1] === "lsp";
  const voiceId = m[2];
  const line = String(clip.text ?? "").trim().slice(0, 200);
  if (!line || !(await canUseVoice(ws, voiceId))) return null;
  const ad = clip.ad_id ? await db.get("ads", String(clip.ad_id)) : null;
  const st = ad?.settings as StorySettings | null;
  const approved = (ad?.settings as { audios?: (string | null)[] } | null)?.audios?.[Number(clip.idx)] ?? null;
  return { line, voiceId, pro, approved, lang: voiceLang(st?.lang ?? "es-CL") as "es" | "en" };
}

const STALE_MS = 5 * 60_000;

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Checks one clip with its provider; when it's ready, copies the video to our storage. */
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const { db } = s;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  try {
    const clip = await db.get("clips", id);
    if (!clip) return NextResponse.json({ error: "Corte no encontrado." }, { status: 404 });
    const ws = s.user.workspace;
    // A start or a voice step that died halfway (server timeout) would stay "starting"/"syncing" forever:
    // after 5 minutes it fails, and the credits go back if they were taken for it.
    if ((clip.status === "starting" || clip.status === "syncing") && Date.now() - Date.parse(String(clip.updated_at ?? clip.created_at)) > STALE_MS) {
      const since = new Date(Date.parse(String(clip.updated_at ?? clip.created_at)) - (clip.status === "syncing" ? 20 * 60_000 : 60_000)).toISOString();
      const row = await db.claim("clips", id, { in: [String(clip.status)] }, { status: "failed", error: "Se cortó a medio camino. Te devolvimos los créditos; vuelve a intentarlo." });
      if (row && (await chargedSince(ws, id, since).catch(() => false))) await refundJob(ws, id);
      return NextResponse.json({ clip: row ?? (await db.get("clips", id)) });
    }
    if (clip.status !== "generating" || !clip.provider_job) return NextResponse.json({ clip });

    // second step of a voiced story shot: the lip-sync job
    if (String(clip.provider_job).startsWith("ls:")) {
      const r = await falPoll(String(clip.provider_job).slice(3), "Sincronizar labios");
      if (r.state !== "done" && r.state !== "failed") return NextResponse.json({ clip });
      if (r.state === "failed") {
        const row = await db.claim("clips", id, { in: ["generating"] }, { status: "failed", error: customerText(`La voz no se pudo sincronizar: ${r.error}`, "La voz no se pudo sincronizar.").slice(0, 500) });
        if (row) await refundJob(ws, id);
        return NextResponse.json({ clip: row ?? (await db.get("clips", id)) });
      }
      const out = (r.out.video as { url?: string } | undefined)?.url;
      if (!out) {
        const row = await db.claim("clips", id, { in: ["generating"] }, { status: "failed", error: "La sincronización no devolvió video." });
        if (row) await refundJob(ws, id);
        return NextResponse.json({ clip: row ?? (await db.get("clips", id)) });
      }
      const name = `${createHash("sha256").update(String(clip.provider_job)).digest("hex").slice(0, 32)}.mp4`;
      let url = mediaRefOf(ws, "videos", name);
      if (!(await mediaSaved(ws, "videos", name))) url = await saveMedia(ws, "videos", await (await fetch(out)).arrayBuffer(), "video/mp4", name);
      const row = await db.update("clips", id, { status: "done", url, error: null });
      if (clip.ad_id) {
        const all = await db.list("clips", `ad_id=eq.${clip.ad_id}&select=status`);
        const ad = await db.get("ads", String(clip.ad_id));
        if (ad?.format !== "historia" && all.length && all.every((c) => c.status === "done")) await db.update("ads", String(clip.ad_id), { status: "review" });
      }
      return NextResponse.json({ clip: row });
    }

    const provider = findVideo(String(clip.model));
    if (!provider) return NextResponse.json({ error: "Modelo desconocido." }, { status: 400 });

    const st = await provider.status({ provider: provider.id, jobId: String(clip.provider_job) });
    if (st.state === "failed") {
      const error = await explainFailure(new Error(st.error), isOwner(s.user), serviceOfModel(provider.id));
      // Only the request that flips the clip from "generating" to "failed" refunds (two tabs polling at
      // once can't refund twice, nor refund an earlier run that worked).
      const row = await db.claim("clips", id, { in: ["generating"] }, { status: "failed", error: error.slice(0, 500) });
      if (row) await refundJob(s.user.workspace, id); // the provider didn't deliver: credits go back
      return NextResponse.json({ clip: row ?? (await db.get("clips", id)) });
    }
    if (st.state !== "done") return NextResponse.json({ clip });
    const name = `${createHash("sha256").update(String(clip.provider_job)).digest("hex").slice(0, 32)}.mp4`;
    let url = mediaRefOf(ws, "videos", name);
    if (!(await mediaSaved(ws, "videos", name))) {
      const bytes = provider.download ? await provider.download(st.url) : await (await fetch(st.url)).arrayBuffer();
      url = await saveMedia(ws, "videos", bytes, "video/mp4", name);
    }
    // voiced story shot: record the line with the character's voice and lip-sync it (only one poll does it)
    const voice = await voiceFor(db, clip, ws);
    if (voice) {
      const mine = await db.claim("clips", id, { in: ["generating"] }, { status: "syncing", url });
      if (!mine) return NextResponse.json({ clip: await db.get("clips", id) });
      try {
        // the recording the customer approved before the video; otherwise record the line now
        // (multilingual_v2 detects the language itself: a forced language_code is rejected)
        const audio = voice.approved ?? (await saveMedia(ws, "historias", (await elevenlabs.speak(voice.voiceId, voice.line, { model: "eleven_multilingual_v2" })).bytes, "audio/mpeg"));
        const media = { video_url: await fetchableUrl(url, ws), audio_url: await fetchableUrl(audio, ws) };
        const job = voice.pro
          ? await falSubmit(LIPSYNC_PRO, { ...media, model: "lipsync-2-pro", sync_mode: "cut_off" }, "Sincronizar labios")
          : await falSubmit(LIPSYNC, media, "Sincronizar labios");
        const row = await db.update("clips", id, { status: "generating", provider_job: `ls:${job}` });
        return NextResponse.json({ clip: row });
      } catch (err) {
        const msg = await explainFailure(err instanceof Error ? err : new Error("No se pudo grabar la voz."), isOwner(s.user), "eleven");
        const row = await db.update("clips", id, { status: "failed", error: `La voz no se pudo agregar: ${msg}`.slice(0, 500) });
        await refundJob(ws, id);
        return NextResponse.json({ clip: row });
      }
    }
    const row = await db.update("clips", id, { status: "done", url, error: null });

    // When every clip of the ad is finished, the ad moves to review.
    const all = await db.list("clips", `ad_id=eq.${clip.ad_id}&select=status`);
    if (all.length && all.every((c) => c.status === "done")) await db.update("ads", String(clip.ad_id), { status: "review" });
    return NextResponse.json({ clip: row });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo revisar el corte.") }, { status: 502 });
  }
}
