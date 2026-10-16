import { NextResponse } from "next/server";
import { needsCredits } from "@/lib/credits";
import { SESSION_ENDED } from "@/lib/access";
import { userFromRequest } from "@/lib/auth";
import { tooMany } from "@/lib/rate";
import { type FormatId, FORMATS, formatById, rondaPrompt, splitRules } from "@/lib/formats";
import { textAI } from "@/lib/providers";
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

// Ported from the prototype's splitScript + fmtSplitRules + rondaSplit.
function buildPrompt(script: string, o: { format: FormatId; cap: number; maxSec: number; lang: "en" | "es-CL"; comment?: { question: string; user: string } }) {
  const f = formatById(o.format);
  const minW = Math.round(o.maxSec * 1.5), maxW = Math.round(o.maxSec * 2.7);
  const spoken = o.lang === "es-CL" ? "español de Chile, natural y hablado (chileno, sin exagerar modismos)" : "inglés hablado natural de EE. UU.";
  const other = o.lang === "es-CL" ? "inglés" : "español";
  const rules = splitRules({ format: o.format, cap: o.cap, comment: o.comment });
  const speakers = f.speakers?.length ? `,"speaker":"${f.speakers.join("|")}"` : "";
  return `Divide este guion de anuncio en video (formato: ${f.name} · ${f.en}) en CORTES para grabarlo con IA.
GUION:
"""
${script.slice(0, 9000)}
"""
Reglas:
- El video se habla en ${spoken}. Si el guion está en otro idioma, primero pásalo a ese idioma con el mismo sentido ("traducido": true). Si ya está en ese idioma, NO lo reescribas ("traducido": false), salvo lo que pida el formato.
- Cada corte dura como máximo ${o.maxSec} segundos: entre ${minW} y ${maxW} palabras habladas, y termina en una pausa natural (fin de frase o de idea).
- Máximo ${o.cap} cortes. Si el guion es más largo, condénsalo sin perder el hook, la oferta ni la llamada a la acción.
- Los cortes van EN ORDEN y juntos cubren todo el guion. "texto" son las palabras exactas que se dicen en ese corte.
- "tipo": Hook, Dolor, Agitación, Mecanismo, Prueba, Oferta, CTA o Transición. El primer corte es el Hook.
- "traduccion": el mismo corte en ${other}, natural.
- "mostrar": qué se ve mientras se dice, en español y concreto (lugar, gesto, objeto).
${f.narr ? "- Es voz en off: nadie habla a cámara; \"mostrar\" describe la escena real que acompaña la frase.\n" : ""}${rules ? `\n${rules}\n(En este formato SÍ puedes reescribir el guion como se indica.)\n` : ""}
Responde SOLO JSON: {"titulo":"nombre corto en español","traducido":false,"cortes":[{"tipo":"Hook","texto":"","traduccion":"","mostrar":""${speakers}}]}`;
}

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
  if (!textAI.configured()) return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY en Vercel." }, { status: 503 });

  const format = (FORMATS.some((f) => f.id === body?.format) ? body.format : "ugc") as FormatId;
  const cap = Math.min(8, Math.max(1, Math.round(Number(body?.cap) || 8)));
  const maxSec = [8, 10, 15].includes(Number(body?.maxSec)) ? Number(body.maxSec) : 8;
  const lang = body?.lang === "es-CL" ? "es-CL" : "en";
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

    const answer = parseJSON<CutsAnswer>(await textAI.complete({ prompt: buildPrompt(script, { format, cap, maxSec, lang, comment }), json: true }));
    if (!Array.isArray(answer.cortes) || !answer.cortes.length) throw new Error("La IA no devolvió cortes.");
    answer.cortes = answer.cortes.filter((c) => c?.texto).slice(0, cap);
    return NextResponse.json(answer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo dividir el guion.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
