import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { fullSession } from "@/lib/access";
import { textAI, findVideo } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";
import { LENGTHS, type StoryPlan, type StorySettings, STYLES, motionPrompt, planPrompt, tidyPlan } from "@/lib/historias";
import { loadStory } from "@/lib/historia-db";
import { canUseVoice } from "@/lib/voices";

export const maxDuration = 120;

const ASPECTS = ["9:16", "16:9", "1:1"];

// POST: writes a new story (free: only Claude) and saves it with one pending row per shot.
export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const idea = String(b?.idea ?? "").trim().slice(0, 3000);
  if (idea.length < 15) return NextResponse.json({ error: "Cuenta un poco más la idea (quién, qué le pasa, cómo termina)." }, { status: 400 });
  const style = STYLES.find((x) => x.id === b?.style)?.id ?? "cine3d";
  const seconds = LENGTHS.includes(Number(b?.seconds)) ? Number(b.seconds) : 30;
  const lang = b?.lang === "en" ? "en" : "es";
  const narrator = b?.narrator === true;
  const aspect = ASPECTS.includes(b?.aspect) ? String(b.aspect) : "9:16";
  const model = findVideo(String(b?.model ?? ""))?.configured() ? String(b.model) : "kling-3.0";
  const voiceId = narrator && typeof b?.voiceId === "string" && (await canUseVoice(s.user.workspace, b.voiceId)) ? b.voiceId : null;
  try {
    const raw = parseJSON<StoryPlan>(await textAI.complete({ prompt: planPrompt({ idea, style, seconds, lang, narrator, aspect }), json: true }));
    const plan = tidyPlan(raw, seconds);
    if (plan.shots.length < 4) throw new Error("La IA no armó suficientes tomas. Intenta de nuevo con más detalle.");
    const settings: StorySettings = { kind: "historia", idea, style, seconds, lang, narrator, voiceId, plan, niche: typeof b?.niche === "string" ? b.niche.slice(0, 40) : undefined };
    const ad = await s.db.insert("ads", { title: plan.title, format: "historia", aspect, model, status: "draft", settings: settings as unknown as Record<string, unknown> });
    await Promise.all(plan.shots.map((sh) => s.db.insert("clips", { ad_id: ad.id, idx: sh.idx, kind: "shot", text: sh.narration || sh.es, prompt: motionPrompt(sh, style), model, status: "pending" })));
    return NextResponse.json({ id: ad.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo escribir la historia." }, { status: 502 });
  }
}

// PATCH {adId, plan?, model?, voiceId?}: the customer edits the story before generating.
export async function PATCH(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const b = await req.json().catch(() => null);
  const adId = String(b?.adId ?? "");
  try {
    const found = await loadStory(s.db, adId);
    if (!found) return NextResponse.json({ error: "Historia no encontrada." }, { status: 404 });
    const st = found.st;
    if (b?.plan) {
      // keep the approved sheets: only text fields come from the browser
      const next = tidyPlan(b.plan as StoryPlan, st.seconds);
      next.characters = next.characters.map((c) => ({ ...c, image_url: st.plan.characters.find((o) => o.key === c.key)?.image_url ?? null }));
      // the shot list can't grow or shrink here (rows already exist)
      if (next.shots.length !== st.plan.shots.length) return NextResponse.json({ error: "No se puede cambiar la cantidad de tomas." }, { status: 400 });
      st.plan = next;
      const clips = await s.db.list("clips", `ad_id=eq.${adId}&order=idx.asc`);
      await Promise.all(clips.map((c) => {
        const sh = next.shots[Number(c.idx)];
        return sh ? s.db.update("clips", String(c.id), { text: sh.narration || sh.es, prompt: motionPrompt(sh, st.style) }) : null;
      }));
    }
    if (typeof b?.voiceId === "string") st.voiceId = (await canUseVoice(s.user.workspace, b.voiceId)) ? b.voiceId : st.voiceId;
    const patch: Record<string, unknown> = { settings: st };
    if (typeof b?.model === "string" && findVideo(b.model)?.configured()) {
      patch.model = b.model;
      const clips = await s.db.list("clips", `ad_id=eq.${adId}`);
      await Promise.all(clips.filter((c) => c.status !== "done" && c.status !== "generating").map((c) => s.db.update("clips", String(c.id), { model: b.model })));
    }
    const row = await s.db.update("ads", adId, patch);
    return NextResponse.json({ ad: row });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo guardar." }, { status: 502 });
  }
}
