import { NextResponse } from "next/server";
import path from "node:path";
import { rm } from "node:fs/promises";
import { tooMany } from "@/lib/rate";
import { fullSession } from "@/lib/access";
import { buildStory, download, probe, speechEnd, workdir } from "@/lib/montage";
import { compose, elevenlabs } from "@/lib/providers/elevenlabs";
import { fetchableUrl, saveMedia } from "@/lib/media";
import { refundJob } from "@/lib/credits";
import { failMessage, failStatus, payFor } from "@/lib/paid";
import { isOwner } from "@/lib/auth";
import { loadStory, updateStory } from "@/lib/historia-db";
import { langById, lyricsPrompt, musicModeOf, needsNewTrack, savedTrack, speaks, voiceLang } from "@/lib/historias";
import { textAI } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";
import { publicError } from "@/lib/public-error";
import { canUseVoice } from "@/lib/voices";

export const maxDuration = 300;

const USD_PER_CHAR = 0.00022; // same as "Voz IA"
const musicUsd = (secs: number) => +((0.15 * Math.max(secs, 15)) / 60).toFixed(3);

// POST {adId, newMusic?, music?, subtitles?, partial?}: (partial: leave out the shots that aren't ready)
// makes the soundtrack as the story asks (AI music or a song with lyrics, made once and again with
// newMusic; the customer's own track; or none), records the narrator's lines if there is a narrator, and
// cuts the film with the characters' voices (unless muted) and each scene's ambient sound (if kept).
// The finished film goes to "Anuncios terminados".
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
  const all = (await s.db.list("clips", `ad_id=eq.${adId}&order=idx.asc`)) as { idx: number; url: string | null; status: string }[];
  const ready = all.filter((c) => c.status === "done" && c.url);
  const clips = b?.partial === true ? ready : all;
  if (ready.length < 2 || clips.some((c) => c.status !== "done" || !c.url)) return NextResponse.json({ error: "Faltan tomas por animar. Anímalas o arma la película solo con las listas." }, { status: 400 });
  const dir = await workdir(`story-${adId}`);
  try {
    // 1. the shots, measured: a shot where someone talks lasts until the line ends
    const shots = await Promise.all(
      clips.map(async (c) => {
        const file = path.join(dir, `s${c.idx}.mp4`);
        await download(await fetchableUrl(c.url!, ws), file);
        const sh = st.plan.shots[c.idx];
        const p = await probe(file);
        const talks = Boolean(sh && speaks(sh)) && p.audio;
        let secs = sh?.seconds ?? 2.5;
        if (talks) secs = Math.max(secs, Math.min(p.dur, await speechEnd(file, p.dur)));
        // muted dialogue: the shot keeps its length but plays without the voice
        const voice = talks && !st.mute_dialogue;
        // muted lines can still be read: they get subtitles like spoken ones
        return { idx: c.idx, file, secs: Math.round(secs * 10) / 10, voice, muted: talks && !voice, ambient: Boolean(st.ambient) && p.audio && !talks, text: sh?.dialogue?.line };
      }),
    );
    const starts = new Map<number, number>();
    const total = shots.reduce((a, x) => { starts.set(x.idx, a); return a + x.secs; }, 0);

    // 2. music, made for the real length (paid once; "otra música" or a longer film makes a new one).
    //    If it can't be made, the film goes out without it (and the music isn't charged).
    // what the screen shows right now (the lyrics box and music style may not have been saved yet)
    if (typeof b?.music === "string" && b.music.trim().length > 5) st.plan.music = b.music.trim().slice(0, 600);
    if (typeof b?.lyrics === "string") st.plan.lyrics = b.lyrics.slice(0, 1200);
    const mode = musicModeOf(st);
    let musicNote = "";
    let track: string | null = mode === "ninguna" ? null : mode === "propia" ? st.own_music_url ?? null : savedTrack(st, mode)?.url ?? null;
    if (mode === "ia" || mode === "cancion") {
      // a song always has lyrics in the story's language: written first (free) if there are none
      if (mode === "cancion" && !st.plan.lyrics?.trim()) {
        try {
          const a = parseJSON<{ lyrics?: string; music?: string }>(await textAI.complete({ prompt: lyricsPrompt({ idea: st.idea, plan: st.plan, lang: st.lang, context: st.context }), json: true, maxTokens: 2000, fast: true }));
          st.plan.lyrics = String(a.lyrics ?? "").replace(/\\n/g, "\n").trim().slice(0, 1200);
          if (typeof a.music === "string" && a.music.trim().length > 10 && !st.plan.music) st.plan.music = a.music.trim().slice(0, 600);
        } catch { /* below: without lyrics the song isn't made */ }
        if (!st.plan.lyrics?.trim()) return NextResponse.json({ error: "Escribe la letra de la canción primero (o toca «Escribir la letra con IA»)." }, { status: 400 });
      }
      const lyrics = st.plan.lyrics?.trim() ?? "";
      // made once per kind and kept: again only when asked, when the film got longer, or (a song) when the lyrics changed
      if (needsNewTrack(st, mode, total, lyrics, b?.newMusic === true)) {
        let ref = "";
        try {
          ref = (await payFor(s.user, musicUsd(total), mode === "cancion" ? "Historia · canción" : "Historia · música", "eleven")).ref;
          const bytes = mode === "cancion"
            ? await compose(`${st.plan.music || "uplifting emotional pop song with a catchy chorus"}. Sung in ${langById(st.lang).spoken}. Sing exactly these lyrics, in this order:\n${lyrics}`, Math.ceil(total) + 2, false)
            : await compose(`${st.plan.music || "cinematic emotional orchestral score that builds to an uplifting climax"}. Instrumental, no vocals.`, Math.ceil(total) + 2, true);
          const url = await saveMedia(ws, "historias", bytes, "audio/mpeg");
          const saved = { url, secs: Math.ceil(total) + 2, ...(mode === "cancion" ? { lyrics } : {}), prompt: st.plan.music };
          track = url;
          await updateStory(s.db, adId, (x) => { x.music_by = { ...(x.music_by ?? {}), [mode]: saved }; x.plan.music = st.plan.music; x.plan.lyrics = st.plan.lyrics; });
        } catch (err) {
          if (ref) await refundJob(ws, ref);
          const what = mode === "cancion" ? "La canción" : "La música";
          const keep = track && !(mode === "cancion" && (savedTrack(st, mode)?.lyrics ?? "").trim() !== lyrics);
          if (!keep) track = null; // never play a song with other lyrics by mistake
          if (!track) musicNote = isOwner(s.user) ? `${what} no se pudo crear (${await failMessage(err, s.user, "eleven")}). La película salió sin música.` : `${what} no se pudo crear esta vez. La película salió sin música; prueba de nuevo en un rato.`;
        }
      } else if (b?.lyrics !== undefined) {
        await updateStory(s.db, adId, (x) => { x.plan.lyrics = st.plan.lyrics; x.plan.music = st.plan.music; }).catch(() => null);
      }
    }

    // 3. narrator: one line per shot that is in the film, starting with its shot. Each line is recorded
    //    once and kept, so rebuilding the film doesn't pay for it again.
    const narrFiles: { file: string; at: number; secs?: number; text?: string }[] = [];
    let narrRef = "";
    if (st.narrator && st.voiceId && (await canUseVoice(ws, st.voiceId))) {
      const lines = shots.map((x) => ({ x, text: st.plan.shots[x.idx]?.narration?.trim() ?? "" })).filter((l) => l.text);
      const cache = { ...(st.narration_cache ?? {}) };
      const keyOf = (t: string) => `${st.voiceId}|${t}`;
      const todo = lines.filter((l) => !cache[keyOf(l.text)]);
      if (todo.length) {
        const chars = todo.reduce((a, l) => a + l.text.length, 0);
        try {
          narrRef = (await payFor(s.user, chars * USD_PER_CHAR, "Historia · narrador", "eleven", { chars })).ref;
          for (const l of todo) {
            const { bytes } = await elevenlabs.speak(st.voiceId, l.text, { model: "eleven_multilingual_v2", lang: voiceLang(st.lang) });
            cache[keyOf(l.text)] = await saveMedia(ws, "historias", bytes, "audio/mpeg");
          }
          await updateStory(s.db, adId, (x) => { x.narration_cache = { ...(x.narration_cache ?? {}), ...cache }; });
        } catch (err) {
          if (narrRef) await refundJob(ws, narrRef);
          return NextResponse.json({ error: await failMessage(err, s.user, "eleven") }, { status: failStatus(err) });
        }
      }
      for (const [i, l] of lines.entries()) {
        const file = path.join(dir, `n${i}.mp3`);
        await download(await fetchableUrl(cache[keyOf(l.text)], ws), file);
        narrFiles.push({ file, at: starts.get(l.x.idx) ?? 0, secs: (await probe(file)).dur || 3, text: l.text });
      }
    }

    // 4. the film
    let music: string | null = null;
    if (track) {
      music = path.join(dir, "music.mp3");
      await download(await fetchableUrl(track, ws), music);
      // the customer's own file must really be audio
      if (mode === "propia" && !(await probe(music).catch(() => ({ audio: false }))).audio) {
        music = null;
        musicNote = "El archivo que subiste no tiene sonido que podamos usar: la película salió sin música. Sube un mp3, m4a o wav.";
      }
    } else if (mode === "propia") musicNote = "No subiste tu música: la película salió sin música. Súbela en «Sonido» y vuelve a armarla.";
    const subtitles = b?.subtitles === true;
    try {
      const { bytes, seconds } = await buildStory(dir, shots, String(ad.aspect || "9:16"), music, narrFiles, subtitles);
      const url = await saveMedia(ws, "finals", bytes, "video/mp4", `${adId}-${Date.now()}.mp4`);
      await updateStory(s.db, adId, (x) => { x.subtitles = subtitles; x.duration = Math.round(seconds * 10) / 10; });
      const row = await s.db.update("ads", adId, { final_url: url, status: "done" });
      return NextResponse.json({ ad: row, url, duration: seconds, note: musicNote || undefined });
    } catch (err) {
      if (narrRef) await refundJob(ws, narrRef); // the narration recorded now stays saved for the next try
      throw err;
    }
  } catch (err) {
    console.error("historias/montar", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: publicError(err, "No se pudo armar la historia.") }, { status: 502 });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => null);
  }
}
