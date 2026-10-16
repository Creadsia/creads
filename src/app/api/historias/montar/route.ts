import { NextResponse } from "next/server";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { tooMany } from "@/lib/rate";
import { fullSession } from "@/lib/access";
import { buildStory, download, probe, trimPoints, workdir } from "@/lib/montage";
import { compose, elevenlabs } from "@/lib/providers/elevenlabs";
import { fetchableUrl, saveMedia } from "@/lib/media";
import { refundJob } from "@/lib/credits";
import { failMessage, failStatus, payFor } from "@/lib/paid";
import { loadStory, saveSettings } from "@/lib/historia-db";
import { speaks, voiceLang } from "@/lib/historias";
import { canUseVoice } from "@/lib/voices";

export const maxDuration = 300;

const USD_PER_CHAR = 0.00022; // same as "Voz IA"
const musicUsd = (secs: number) => +((0.15 * Math.max(secs, 15)) / 60).toFixed(3);

// POST {adId, newMusic?, music?, subtitles?}: makes the soundtrack (once; again with newMusic), the narrator's lines
// if the story has a narrator, and cuts the film. The finished film goes to "Anuncios terminados".
export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const limited = await tooMany("heavy", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const adId = String(b?.adId ?? "");
  const found = await loadStory(s.db, adId).catch(() => null);
  if (!found) return NextResponse.json({ error: "Historia no encontrada." }, { status: 404 });
  const { ad, st } = found;
  const ws = s.user.workspace;
  const clips = (await s.db.list("clips", `ad_id=eq.${adId}&order=idx.asc`)) as { idx: number; url: string | null; status: string }[];
  if (!clips.length || clips.some((c) => c.status !== "done" || !c.url)) return NextResponse.json({ error: "Espera a que todas las tomas estén animadas." }, { status: 400 });
  const total = st.plan.shots.reduce((a, x) => a + x.seconds, 0);

  // 1. music (paid once; "otra música" makes a new one)
  if (typeof b?.music === "string" && b.music.trim().length > 5) st.plan.music = b.music.trim().slice(0, 600);
  if (!st.music_url || b?.newMusic === true) {
    let ref = "";
    try {
      ref = (await payFor(s.user, musicUsd(total), "Historia · música", "eleven")).ref;
      const bytes = await compose(`${st.plan.music || "cinematic emotional orchestral score that builds to an uplifting climax"}. Instrumental, no vocals.`, Math.ceil(total) + 2, true);
      st.music_url = await saveMedia(ws, "historias", bytes, "audio/mpeg");
      await saveSettings(s.db, adId, st);
    } catch (err) {
      if (ref) await refundJob(ws, ref);
      return NextResponse.json({ error: await failMessage(err, s.user, "eleven") }, { status: failStatus(err) });
    }
  }

  // 2. narrator: one line per shot, placed where its shot starts
  const lines: { text: string; at: number }[] = [];
  if (st.narrator) {
    let at = 0;
    for (const sh of st.plan.shots) {
      if (sh.narration?.trim()) lines.push({ text: sh.narration.trim(), at });
      at += sh.seconds;
    }
  }
  const narr = st.narrator && lines.length && st.voiceId && (await canUseVoice(ws, st.voiceId)) ? lines : [];
  const dir = await workdir(`story-${adId}`);
  const narrFiles: { file: string; at: number; secs?: number; text?: string }[] = [];
  if (narr.length) {
    const chars = narr.reduce((a, l) => a + l.text.length, 0);
    let ref = "";
    try {
      ref = (await payFor(s.user, chars * USD_PER_CHAR, "Historia · narrador", "eleven", { chars })).ref;
      for (const [i, l] of narr.entries()) {
        const { bytes } = await elevenlabs.speak(st.voiceId!, l.text, { model: "eleven_multilingual_v2", lang: voiceLang(st.lang) });
        const file = path.join(dir, `n${i}.mp3`);
        await writeFile(file, Buffer.from(bytes));
        narrFiles.push({ file, at: l.at, secs: (await probe(file)).dur || 3, text: l.text });
      }
    } catch (err) {
      if (ref) await refundJob(ws, ref);
      return NextResponse.json({ error: await failMessage(err, s.user, "eleven") }, { status: failStatus(err) });
    }
  }

  // 3. the film
  try {
    const shots = await Promise.all(
      clips.map(async (c) => {
        const file = path.join(dir, `s${c.idx}.mp4`);
        await download(await fetchableUrl(c.url!, ws), file);
        const sh = st.plan.shots[c.idx];
        // shots where a character speaks keep the voice the model made (if the clip has sound)
        const p = await probe(file);
        const voice = Boolean(sh && speaks(sh)) && p.audio;
        let secs = sh?.seconds ?? 2.5;
        // never cut a line: the shot lasts at least until the speech ends
        if (voice) secs = Math.max(secs, Math.min(p.dur, (await trimPoints(file, p.dur)).b + 0.3));
        return { file, secs: Math.round(secs * 10) / 10, voice, text: sh?.dialogue?.line };
      }),
    );
    const music = path.join(dir, "music.mp3");
    await download(await fetchableUrl(st.music_url!, ws), music);
    const subtitles = b?.subtitles === true;
    const { bytes, seconds } = await buildStory(dir, shots, String(ad.aspect || "9:16"), music, narrFiles, subtitles);
    const url = await saveMedia(ws, "finals", bytes, "video/mp4", `${adId}-${Date.now()}.mp4`);
    const row = await s.db.update("ads", adId, { final_url: url, status: "done", settings: { ...st, subtitles, duration: Math.round(seconds * 10) / 10 } });
    return NextResponse.json({ ad: row, url, duration: seconds });
  } catch (err) {
    console.error("historias/montar", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo armar la historia." }, { status: 502 });
  }
}
