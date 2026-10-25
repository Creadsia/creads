import { NextResponse } from "next/server";
import { needsCredits } from "@/lib/credits";
import { SESSION_ENDED } from "@/lib/access";
import { userFromRequest } from "@/lib/auth";
import { tooMany } from "@/lib/rate";
import { type FormatId, FORMATS, rondaPrompt } from "@/lib/formats";
import { cutsPrompt } from "@/lib/cuts-prompt";
import { readLang } from "@/lib/ad-lang";
import { textAI } from "@/lib/providers";
import { FEATURE_UNAVAILABLE as UNAVAILABLE_TEXT, publicError } from "@/lib/public-error";
import { parseJSON } from "@/lib/providers/claude";

export const maxDuration = 90;

export interface Cut {
  tipo: string;
  texto: string; // exact words spoken in this cut, in the video's language
  traduccion: string; // the same line in the other language, so the owner can read it
  mostrar: string; // what we see, in Spanish
  speaker?: string; // adapted formats: who speaks (host/guest, reporter/homeowner, voice/person)
  persona?: string; // ronda: who is on camera, in English
}

interface CutsAnswer {
  titulo: string;
  traducido: boolean;
  cortes: Cut[];
}

// The split prompt lives in src/lib/cuts-prompt.ts (ported from the prototype's splitScript + fmtSplitRules).

interface RondaAnswer {
  titulo: string;
  cortes: { tipo: string; persona: string; mostrar: string; lineas: { speaker: string; text: string; es: string }[] }[];
}

export async function POST(req: Request) {
  const user = await userFromRequest(req);
  if (!user) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("ai", user.id);
  if (limited) return limited;
  const broke = await needsCredits(user);
  if (broke) return NextResponse.json({ error: broke }, { status: 402 });

  const body = await req.json().catch(() => null);
  const script = typeof body?.script === "string" ? body.script.trim() : "";
  if (script.length < 40) return NextResponse.json({ error: "Pega un guion más largo (al menos un par de frases)." }, { status: 400 });
  if (!textAI.configured()) return NextResponse.json({ error: UNAVAILABLE_TEXT }, { status: 503 });

  const format = (FORMATS.some((f) => f.id === body?.format) ? body.format : "ugc") as FormatId;
  const cap = Math.min(8, Math.max(1, Math.round(Number(body?.cap) || 8)));
  const maxSec = [8, 10, 15].includes(Number(body?.maxSec)) ? Number(body.maxSec) : 8;
  const lang = readLang(body?.lang, "en");
  const comment = body?.comment && typeof body.comment === "object" ? { question: String(body.comment.question ?? "").slice(0, 200), user: String(body.comment.user ?? "").slice(0, 40) } : undefined;

  try {
    if (format === "ronda") {
      const place = String(body?.ronda?.place ?? "").slice(0, 160);
      if (!place) return NextResponse.json({ error: "Escribe dónde es la ronda." }, { status: 400 });
      const r = parseJSON<RondaAnswer>(
        await textAI.complete({ prompt: rondaPrompt(script, { format, cap, ronda: { place, who: String(body?.ronda?.who ?? "").slice(0, 200) } }, Math.max(18, Math.floor(maxSec * 2.7) - 2)), json: true }),
      );
      let last = "";
      const cortes: Cut[] = (r.cortes ?? []).filter((c) => c.lineas?.some((l) => l?.text)).slice(0, cap).map((c) => {
        const persona = String(c.persona ?? "").trim();
        if (persona && !/^(the )?same\b/i.test(persona)) last = persona;
        const ls = c.lineas.filter((l) => l?.text);
        const who = new Set(ls.map((l) => l.speaker)).size > 1 ? "dialogo" : ls[0].speaker === "voice" ? "voice" : "person";
        return { tipo: c.tipo, texto: ls.map((l) => l.text).join(" "), traduccion: ls.map((l) => l.es).join(" "), mostrar: c.mostrar, speaker: who, persona: last };
      });
      if (!cortes.length) throw new Error("La IA no devolvió cortes.");
      return NextResponse.json({ titulo: r.titulo || "Ronda", traducido: true, cortes });
    }

    const answer = parseJSON<CutsAnswer>(await textAI.complete({ prompt: cutsPrompt(script, { format, cap, maxSec, lang, comment }), json: true }));
    if (!Array.isArray(answer.cortes) || !answer.cortes.length) throw new Error("La IA no devolvió cortes.");
    answer.cortes = answer.cortes.filter((c) => c?.texto).slice(0, cap);
    return NextResponse.json(answer);
  } catch (err) {
    const msg = publicError(err, "No se pudo dividir el guion.");
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
