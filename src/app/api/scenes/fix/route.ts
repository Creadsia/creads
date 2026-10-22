import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { SESSION_ENDED, session } from "@/lib/access";
import { formatById } from "@/lib/formats";
import { textAI } from "@/lib/providers";
import { publicError } from "@/lib/public-error";
import { parseJSON } from "@/lib/providers/claude";

export const maxDuration = 60;

interface Dir { setting?: string; framing?: string; action?: string; broll?: string; emotion?: string; movement?: string; es?: string }

// «¿Qué quieres cambiar en esta escena?»: before anything is generated, rewrites one cut's prompt (and its
// short description) with the change the customer wrote in their own words. The spoken words never change.
// Free (one short Claude call).
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const prompt = String(b?.prompt ?? "").slice(0, 8000);
  const line = String(b?.texto ?? "").slice(0, 600);
  const change = String(b?.cambio ?? "").trim().slice(0, 600);
  const dir = (b?.dir ?? {}) as Dir;
  if (!prompt || !change) return NextResponse.json({ error: "Escribe qué quieres cambiar en la escena." }, { status: 400 });
  const f = formatById(String(b?.format || "ugc"));
  try {
    const r = parseJSON<{ prompt: string; dir: Dir; cambios: string }>(
      await textAI.complete({
        json: true,
        maxTokens: 3000,
        prompt: `You direct one cut of a ${f.en} video ad and write the prompt for an AI video model.
THE CUSTOMER WANTS THIS CHANGE (written in Spanish, follow it faithfully; it is about what we see, never about the words):
"""${change}"""
CURRENT SCENE: setting: ${dir.setting ?? "-"} | framing: ${dir.framing ?? "-"} | action: ${dir.action ?? "-"} | b-roll: ${dir.broll ?? "-"} | emotion: ${dir.emotion ?? "-"} | movement: ${dir.movement ?? "-"}
CURRENT PROMPT:
"""
${prompt}
"""
Rewrite the prompt applying the change. Rules:
- The spoken words stay EXACTLY as written, every word, same order: "${line}". Keep the SPOKEN LINE / DIALOGUE block and the final Reminder as they are.
- Keep any FORMAT LOCK / REMINDER / LANGUAGE / PRODUCT / LESSONS block as it is; keep the same person, wardrobe and overall style unless the change asks otherwise.
- Make it believable real phone footage; no on-screen text, logos or captions.
- Plain English.
Also update the short scene description fields to match the new prompt (English, a few words each), and "es": the same scene in 1–2 natural Spanish sentences for the customer.
Reply ONLY JSON: {"prompt":"the full new prompt","dir":{"setting":"…","framing":"…","action":"…","broll":"…","emotion":"…","movement":"…","es":"…"},"cambios":"en español, 1 frase: qué cambió"}`,
      }),
    );
    if (!r?.prompt || (line && !r.prompt.includes(line.slice(0, 20)))) throw new Error("La IA cambió las palabras del corte; intenta de nuevo.");
    return NextResponse.json({ prompt: r.prompt, dir: { ...dir, ...(r.dir ?? {}) }, cambios: r.cambios ?? "" });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo cambiar la escena.") }, { status: 502 });
  }
}
