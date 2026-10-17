import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { needsCredits } from "@/lib/credits";
import { tooMany } from "@/lib/rate";
import { textAI } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";
import { FEATURE_UNAVAILABLE, publicError } from "@/lib/public-error";
import { type GuionRequest, MODES, type Mode, SCRIPT_LANGS, type ScriptLang, guionPrompt, tidyAnswer } from "@/lib/guiones";
import { cleanNiche } from "@/lib/niches";

export const maxDuration = 120;

// Generador de guiones: one AI action on a script (take it apart, angles, hooks, improve, idea,
// lengths, or write from scratch). Free with an active plan (only text AI, no generation).
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  const broke = await needsCredits(s.user);
  if (broke) return NextResponse.json({ error: broke }, { status: 402 });
  if (!textAI.configured()) return NextResponse.json({ error: FEATURE_UNAVAILABLE }, { status: 503 });

  const b = await req.json().catch(() => null);
  const mode = MODES.find((m) => m.id === b?.mode)?.id as Mode | undefined;
  if (!mode) return NextResponse.json({ error: "Elige qué quieres hacer con el guion." }, { status: 400 });
  const r: GuionRequest = {
    mode,
    script: String(b?.script ?? "").slice(0, 8000),
    lang: (SCRIPT_LANGS.find((l) => l.id === b?.lang)?.id ?? "es-CL") as ScriptLang,
    niche: cleanNiche(b?.niche) || undefined,
    context: String(b?.context ?? "").slice(0, 1500),
    idea: String(b?.idea ?? "").slice(0, 600),
    level: b?.level === "max" ? "max" : "fiel",
  };
  const words = r.script.trim().split(/\s+/).filter(Boolean).length;
  if (mode === "crear" && r.context!.trim().length < 20 && !r.niche) return NextResponse.json({ error: "Cuéntanos qué vendes y a quién (al menos una frase), o elige un nicho." }, { status: 400 });
  if (mode !== "crear" && words < 12) return NextResponse.json({ error: "Pega un guion más completo (al menos un par de frases)." }, { status: 400 });
  if (mode === "idea" && r.idea!.trim().length < 5) return NextResponse.json({ error: "Escribe la idea que quieres probar." }, { status: 400 });

  try {
    const raw = parseJSON<Record<string, unknown>>(await textAI.complete({ prompt: guionPrompt(r), json: true, maxTokens: 8000 }));
    const out = tidyAnswer(mode, raw);
    const empty = mode === "desarmar" ? !out.analysis : mode === "hooks" ? !out.hooks?.length : !out.scripts?.length;
    if (empty) throw new Error("La respuesta llegó incompleta.");
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo trabajar el guion.") }, { status: 502 });
  }
}
