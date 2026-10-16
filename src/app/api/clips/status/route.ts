import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { SESSION_ENDED, session } from "@/lib/access";
import { findVideo } from "@/lib/providers";
import { mediaRefOf, mediaSaved, saveMedia } from "@/lib/media";
import { explainFailure, serviceOfModel } from "@/lib/balances";
import { refundJob } from "@/lib/credits";
import { isOwner } from "@/lib/auth";
import { fetchableUrl } from "@/lib/media";
import { falPoll, falSubmit } from "@/lib/providers/fal";
import { elevenlabs } from "@/lib/providers/elevenlabs";
import { type StorySettings, voiceLang } from "@/lib/historias";

const LIPSYNC = "fal-ai/kling-video/lipsync/audio-to-video";

/** Story shots whose speaker has their own voice: after the animation, the line is recorded with that
 * voice and lip-synced onto the clip (a second job, "ls:<fal job>"). */
async function voiceFor(db: { get: (t: "ads", id: string) => Promise<Record<string, unknown> | null> }, adId: string, idx: number) {
  const ad = await db.get("ads", adId);
  if (!ad || ad.format !== "historia") return null;
  const st = ad.settings as StorySettings | null;
  const shot = st?.plan?.shots?.[idx];
  const line = shot?.dialogue?.line?.trim();
  const voiceId = line ? st?.plan.characters.find((c) => c.key === shot!.dialogue!.speaker)?.voiceId : null;
  return line && voiceId ? { line, voiceId, lang: voiceLang(st!.lang) as "es" | "en" } : null;
}

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
    if (clip.status !== "generating" || !clip.provider_job) return NextResponse.json({ clip });
    const ws = s.user.workspace;

    // second step of a voiced story shot: the lip-sync job
    if (String(clip.provider_job).startsWith("ls:")) {
      const r = await falPoll(String(clip.provider_job).slice(3), "Sincronizar labios");
      if (r.state !== "done" && r.state !== "failed") return NextResponse.json({ clip });
      if (r.state === "failed") {
        const row = await db.claim("clips", id, { in: ["generating"] }, { status: "failed", error: `La voz no se pudo sincronizar: ${r.error}`.slice(0, 500) });
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
    const voice = clip.ad_id ? await voiceFor(db, String(clip.ad_id), Number(clip.idx)) : null;
    if (voice) {
      const mine = await db.claim("clips", id, { in: ["generating"] }, { status: "syncing", url });
      if (!mine) return NextResponse.json({ clip: await db.get("clips", id) });
      try {
        const { bytes } = await elevenlabs.speak(voice.voiceId, voice.line, { model: "eleven_multilingual_v2", lang: voice.lang });
        const audio = await saveMedia(ws, "historias", bytes, "audio/mpeg");
        const job = await falSubmit(LIPSYNC, { video_url: await fetchableUrl(url, ws), audio_url: await fetchableUrl(audio, ws) }, "Sincronizar labios");
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
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo revisar el corte." }, { status: 502 });
  }
}
