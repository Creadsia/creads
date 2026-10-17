import { NextResponse } from "next/server";
import { needsCredits } from "@/lib/credits";
import { tooMany } from "@/lib/rate";
import { fullSession } from "@/lib/access";
import { textAI } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";
import { lyricsPrompt } from "@/lib/historias";
import { loadStory, updateStory } from "@/lib/historia-db";
import { publicError } from "@/lib/public-error";

export const maxDuration = 120;

// POST {adId}: Creads IA writes (or rewrites) the lyrics of the story's song and the song's style.
// Free (text only). The song itself is made when the film is built.
export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  const broke = await needsCredits(s.user);
  if (broke) return NextResponse.json({ error: broke }, { status: 402 });
  const b = await req.json().catch(() => null);
  const adId = String(b?.adId ?? "");
  const found = await loadStory(s.db, adId).catch(() => null);
  if (!found) return NextResponse.json({ error: "Historia no encontrada." }, { status: 404 });
  const { st } = found;
  try {
    const a = parseJSON<{ lyrics?: string; music?: string }>(await textAI.complete({ prompt: lyricsPrompt({ idea: st.idea, plan: st.plan, lang: st.lang, context: st.context }), json: true, maxTokens: 2000, fast: true }));
    const lyrics = String(a.lyrics ?? "").replace(/\\n/g, "\n").trim().slice(0, 1200);
    if (lyrics.split("\n").filter((l) => l.trim()).length < 3) throw new Error("La letra salió muy corta. Intenta de nuevo.");
    const saved = await updateStory(s.db, adId, (x) => {
      x.plan.lyrics = lyrics;
      if (typeof a.music === "string" && a.music.trim().length > 10) x.plan.music = a.music.trim().slice(0, 600);
    });
    return NextResponse.json({ lyrics: saved.plan.lyrics, music: saved.plan.music });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo escribir la letra.") }, { status: 502 });
  }
}
