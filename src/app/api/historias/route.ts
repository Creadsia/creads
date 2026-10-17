import { NextResponse } from "next/server";
import { needsCredits } from "@/lib/credits";
import { tooMany } from "@/lib/rate";
import { fullSession } from "@/lib/access";
import { textAI, findVideo } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";
import { LANGS, LENGTHS, type MusicMode, type StoryPlan, type StorySettings, STYLES, motionPrompt, musicModeOf, planPrompt, tidyPlan } from "@/lib/historias";
import { ownsMedia } from "@/lib/media";
import { loadStory, updateStory } from "@/lib/historia-db";
import { publicError } from "@/lib/public-error";
import { canUseVoice } from "@/lib/voices";

export const maxDuration = 300;

const ASPECTS = ["9:16", "16:9", "1:1"];

// POST: writes a new story (free: only Claude) and saves it with one pending row per shot.
export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  const broke = await needsCredits(s.user);
  if (broke) return NextResponse.json({ error: broke }, { status: 402 });
  const b = await req.json().catch(() => null);
  const idea = String(b?.idea ?? "").trim().slice(0, 3000);
  if (idea.length < 15) return NextResponse.json({ error: "Cuenta un poco más la idea (quién, qué le pasa, cómo termina)." }, { status: 400 });
  const style = STYLES.find((x) => x.id === b?.style)?.id ?? "cine3d";
  const seconds = LENGTHS.includes(Number(b?.seconds)) ? Number(b.seconds) : 30;
  const lang = LANGS.find((l) => l.id === b?.lang)?.id ?? "es-CL";
  const narrator = b?.narrator === true;
  const dialogue = b?.dialogue === true;
  const aspect = ASPECTS.includes(b?.aspect) ? String(b.aspect) : "9:16";
  const model = findVideo(String(b?.model ?? ""))?.configured() ? String(b.model) : "kling-3.0";
  const voiceId = narrator && typeof b?.voiceId === "string" && (await canUseVoice(s.user.workspace, b.voiceId)) ? b.voiceId : null;
  const context = typeof b?.context === "string" ? b.context.trim().slice(0, 1500) : "";
  const music_mode = musicModeOf({ music_mode: b?.music });
  const ambient = b?.ambient === true;
  // the customer's own track, uploaded to their own folder
  const own_music_url = music_mode === "propia" && ownsMedia(b?.musicUrl, s.user.workspace) ? String(b.musicUrl) : null;
  try {
    const raw = parseJSON<StoryPlan>(await textAI.complete({ prompt: planPrompt({ idea, style, seconds, lang, narrator, dialogue, aspect, context, music: music_mode }), json: true, maxTokens: 20000 }));
    const plan = tidyPlan(raw, seconds);
    if (plan.shots.length < 4) throw new Error("La IA no armó suficientes tomas. Intenta de nuevo con más detalle.");
    const settings: StorySettings = { kind: "historia", idea, context, style, seconds, lang, narrator, dialogue, voiceId, plan, music_mode, ambient, own_music_url, niche: typeof b?.niche === "string" ? b.niche.slice(0, 40) : undefined };
    const ad = await s.db.insert("ads", { title: plan.title, format: "historia", aspect, model, status: "draft", settings: settings as unknown as Record<string, unknown> });
    await Promise.all(plan.shots.map((sh) => s.db.insert("clips", { ad_id: ad.id, idx: sh.idx, kind: "shot", text: sh.dialogue?.line || sh.narration || sh.es, prompt: motionPrompt(sh, style, plan, lang, ambient), model, status: "pending" })));
    return NextResponse.json({ id: ad.id });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo escribir la historia.") }, { status: 502 });
  }
}

// PATCH {adId, plan?, model?, voiceId?, sound?}: the customer edits the story before generating.
// sound: {music?: MusicMode, musicUrl?: own track, lyrics?, ambient?, narrator?, mute?, context?}
export async function PATCH(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const b = await req.json().catch(() => null);
  const adId = String(b?.adId ?? "");
  try {
    const found = await loadStory(s.db, adId);
    if (!found) return NextResponse.json({ error: "Historia no encontrada." }, { status: 404 });
    let next: StoryPlan | null = null;
    if (b?.plan) {
      // only text fields come from the browser (no re-scaling of the customer's lengths)
      next = tidyPlan(b.plan as StoryPlan, found.st.seconds, false);
      // a character's voice must be one this customer may use
      for (const c of next.characters) if (c.voiceId && !(await canUseVoice(s.user.workspace, c.voiceId))) c.voiceId = null;
      // the shot list can't grow or shrink here (rows already exist)
      if (next.shots.length !== found.st.plan.shots.length) return NextResponse.json({ error: "No se puede cambiar la cantidad de tomas." }, { status: 400 });
    }
    const voiceId = typeof b?.voiceId === "string" && (await canUseVoice(s.user.workspace, b.voiceId)) ? b.voiceId : null;
    const snd = b?.sound && typeof b.sound === "object" ? b.sound as Record<string, unknown> : null;
    const ambientBefore = Boolean(found.st.ambient);
    if (snd?.narrator === true && !voiceId && !found.st.voiceId) return NextResponse.json({ error: "Elige la voz del narrador." }, { status: 400 });
    if (snd?.musicUrl !== undefined && snd.musicUrl !== null && !ownsMedia(snd.musicUrl, s.user.workspace)) return NextResponse.json({ error: "Ese archivo no es de tu cuenta." }, { status: 400 });
    // written on the latest saved story: the approved sheets (made meanwhile, maybe) are kept
    const st = await updateStory(s.db, adId, (x) => {
      if (next) {
        next.characters = next.characters.map((c) => {
          const old = x.plan.characters.find((o) => o.key === c.key);
          return { ...c, image_url: old?.image_url ?? null, avatar: old?.avatar ?? null };
        });
        // the song's lyrics and style change only through their own fields (a stale screen can't undo them)
        next.lyrics = x.plan.lyrics;
        next.music = x.plan.music;
        x.plan = next;
      }
      if (snd) {
        if (typeof snd.music === "string") x.music_mode = musicModeOf({ music_mode: snd.music }) as MusicMode;
        if (snd.musicUrl === null || typeof snd.musicUrl === "string") x.own_music_url = (snd.musicUrl as string | null) || null;
        if (typeof snd.lyrics === "string") x.plan.lyrics = snd.lyrics.slice(0, 1200);
        if (typeof snd.musicPrompt === "string" && snd.musicPrompt.trim()) x.plan.music = snd.musicPrompt.trim().slice(0, 600);
        if (typeof snd.ambient === "boolean") x.ambient = snd.ambient;
        if (typeof snd.narrator === "boolean") x.narrator = snd.narrator;
        if (typeof snd.mute === "boolean") { x.mute_dialogue = snd.mute; if (!snd.mute) x.dialogue = true; }
        if (typeof snd.context === "string") x.context = snd.context.slice(0, 1500);
      }
      if (voiceId) x.voiceId = voiceId;
    });
    if (next || Boolean(st.ambient) !== ambientBefore) {
      // shots being animated keep what they were started (and paid) with
      const clips = await s.db.list("clips", `ad_id=eq.${adId}&order=idx.asc`);
      await Promise.all(clips.filter((c) => !["generating", "starting", "syncing"].includes(String(c.status))).map((c) => {
        const sh = st.plan.shots[Number(c.idx)];
        return sh ? s.db.update("clips", String(c.id), { text: sh.dialogue?.line || sh.narration || sh.es, prompt: motionPrompt(sh, st.style, st.plan, st.lang, Boolean(st.ambient)) }) : null;
      }));
    }
    const patch: Record<string, unknown> = {};
    if (typeof b?.model === "string" && findVideo(b.model)?.configured()) {
      patch.model = b.model;
      const clips = await s.db.list("clips", `ad_id=eq.${adId}`);
      await Promise.all(clips.filter((c) => !["done", "generating", "starting", "syncing"].includes(String(c.status))).map((c) => s.db.update("clips", String(c.id), { model: b.model })));
    }
    const row = Object.keys(patch).length ? await s.db.update("ads", adId, patch) : await s.db.get("ads", adId);
    return NextResponse.json({ ad: row, settings: st });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo guardar.") }, { status: 502 });
  }
}
