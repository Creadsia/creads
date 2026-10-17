import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { SESSION_ENDED, session } from "@/lib/access";
import { sharedRules } from "@/lib/db";
import { formatById } from "@/lib/formats";
import { textAI } from "@/lib/providers";
import { publicError } from "@/lib/public-error";
import { parseJSON } from "@/lib/providers/claude";

export const maxDuration = 60;

// Rewrites one clip's prompt to fix a problem, keeping the spoken words locked (prototype: aiFixPrompt).
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  const { db } = s;
  const b = await req.json().catch(() => null);
  const id = String(b?.id ?? "");
  const what = String(b?.problem ?? "").slice(0, 800);
  try {
    const clip = await db.get("clips", id);
    if (!clip) return NextResponse.json({ error: "Corte no encontrado." }, { status: 404 });
    const ad = await db.get("ads", String(clip.ad_id));
    const f = formatById(String(ad?.format || "ugc"));
    const rules = ((await sharedRules.list("active=eq.true&order=hits.desc&limit=10").catch(() => [])) as { rule_en: string }[]).map((r) => r.rule_en);
    const r = parseJSON<{ prompt: string; cambios: string }>(
      await textAI.complete({
        json: true,
        prompt: `You fix prompts for AI video models (Veo, Kling, Seedance). This clip is one cut of a ${f.en} ad and it must look like the other cuts of the same video.
WHAT TO FIX (written in Spanish by the user and/or a reviewer): ${what || "make it a clean, fluent take that matches the other clips"}
CURRENT PROMPT:
"""
${String(clip.prompt).slice(0, 7000)}
"""
${rules.length ? `LESSONS FROM PAST VIDEOS (keep them in the prompt):\n- ${rules.join("\n- ")}\n` : ""}Rewrite the prompt so the problem is fixed. Rules:
- Keep every spoken line EXACTLY as written (the SPOKEN LINE or DIALOGUE block and the final Reminder), same words, same order.
- Keep any FORMAT LOCK / REMINDER block exactly as it is; keep the same format and style.
- Clothes, hair or face problems: add near the top a line starting "WARDROBE AND LOOK (identical to every other clip of this ad):" describing the exact garments, colors and hair, and forbid any other outfit.
- Place problems: describe the exact same place as the other clips.
- Speech problems: one clean fluent take, no stutter, no repeated words, finish the last word before the clip ends.
- Plain English text.
Reply ONLY JSON: {"prompt":"the full new prompt","cambios":"en español, 1 frase: qué cambiaste"}`,
      }),
    );
    if (!r?.prompt || !r.prompt.includes(String(clip.text).slice(0, 20))) throw new Error("La IA cambió las palabras del corte; intenta de nuevo.");
    const row = await db.update("clips", id, { prompt: r.prompt });
    return NextResponse.json({ clip: row, cambios: r.cambios });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo corregir el corte.") }, { status: 502 });
  }
}
