import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { fullSession } from "@/lib/access";
import { textAI } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";
import path from "node:path";
import { fetchableUrl } from "@/lib/media";
import { download, thumbnail, workdir } from "@/lib/montage";
import { dialoguePrompt, lineSeconds, motionPrompt } from "@/lib/historias";
import { loadStory, saveSettings } from "@/lib/historia-db";

export const maxDuration = 300;

// POST {adId, context?}: Claude writes the dialogue of the whole story from the idea, the customer's
// extra context and the shot images it can see. Free (no generation). Shots whose line changed must be
// animated again to speak; the screen shows which.
export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const adId = String(b?.adId ?? "");
  const context = typeof b?.context === "string" ? b.context.slice(0, 2000) : "";
  const found = await loadStory(s.db, adId).catch(() => null);
  if (!found) return NextResponse.json({ error: "Historia no encontrada." }, { status: 404 });
  const { st } = found;
  try {
    const clips = await s.db.list("clips", `ad_id=eq.${adId}&order=idx.asc`);
    const frames = st.plan.shots.map((_, i) => clips.find((c) => Number(c.idx) === i)?.image_url as string | null | undefined);
    // small copies of the shot images, so Claude can look at all of them
    const dir = await workdir(`dlg-${adId}`);
    const urls = await Promise.all(frames.slice(0, 24).map(async (f, i) => {
      if (!f) return null;
      try {
        const src = path.join(dir, `f${i}`);
        await download(await fetchableUrl(f, s.user.workspace, 600), src);
        return `data:image/jpeg;base64,${(await thumbnail(src, path.join(dir, `t${i}.jpg`))).toString("base64")}`;
      } catch {
        return null;
      }
    }));
    const withImages = urls.map(Boolean);
    const answer = parseJSON<{ shots: { idx: number; dialogue: { speaker?: string; line?: string } | null }[] }>(
      await textAI.complete({ prompt: dialoguePrompt({ idea: st.idea, plan: st.plan, lang: st.lang, context, withImages }), images: urls.filter((u): u is string => Boolean(u)), json: true, maxTokens: 6000 }),
    );
    const keys = new Set(st.plan.characters.map((c) => c.key));
    const changed: number[] = [];
    for (const a of answer.shots ?? []) {
      const sh = st.plan.shots[Number(a.idx)];
      if (!sh) continue;
      const k = String(a.dialogue?.speaker ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
      const line = String(a.dialogue?.line ?? "").trim().slice(0, 160);
      const next = k && keys.has(k) && line ? { speaker: k, line } : null;
      if ((next?.line ?? "") !== (sh.dialogue?.line ?? "") || (next?.speaker ?? "") !== (sh.dialogue?.speaker ?? "")) changed.push(sh.idx);
      sh.dialogue = next;
      if (next) sh.seconds = Math.min(8, Math.max(sh.seconds, lineSeconds(next.line)));
    }
    st.dialogue = true;
    await saveSettings(s.db, adId, st);
    await Promise.all(clips.map((c) => {
      const sh = st.plan.shots[Number(c.idx)];
      return sh ? s.db.update("clips", String(c.id), { text: sh.dialogue?.line || sh.narration || sh.es, prompt: motionPrompt(sh, st.style, st.plan, st.lang) }) : null;
    }));
    return NextResponse.json({ plan: st.plan, changed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudieron escribir los diálogos." }, { status: 502 });
  }
}
