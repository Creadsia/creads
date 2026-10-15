import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { textAI } from "@/lib/providers";
import { parseJSON } from "@/lib/providers/claude";

export const maxDuration = 60;

export interface Cut {
  tipo: string;
  texto: string; // exact English words spoken in this cut
  traduccion: string;
  mostrar: string;
}

interface CutsAnswer {
  titulo: string;
  traducido: boolean;
  cortes: Cut[];
}

// Ported from the prototype's splitScript (UGC selfie format): the script becomes ≤8 cuts of ~8 s each.
function buildPrompt(script: string, maxCuts: number) {
  return `Divide este guion de anuncio en video (UGC selfie, lead gen de servicios en EE. UU.) en CORTES para grabarlo con IA.
GUION:
"""
${script.slice(0, 9000)}
"""
Reglas:
- Si el guion NO está en inglés, primero pásalo a un inglés hablado natural de EE. UU. con el mismo sentido y usa esa versión ("traducido": true). Si ya está en inglés, NO lo reescribas ("traducido": false).
- Cada corte dura como máximo 8 segundos: entre 12 y 22 palabras habladas, y termina en una pausa natural (fin de frase o de idea).
- Máximo ${maxCuts} cortes. Si el guion es más largo, condénsalo sin perder el hook, la oferta ni la llamada a la acción.
- Los cortes van EN ORDEN y juntos cubren todo el guion. "texto" son las palabras exactas que dice la persona en ese corte, en inglés.
- "tipo": Hook, Dolor, Agitación, Mecanismo, Prueba, Oferta, CTA o Transición. El primer corte es el Hook.
- "traduccion": traducción natural al español del corte.
- "mostrar": qué se ve mientras lo dice, en español y concreto (lugar, gesto, objeto).
Responde SOLO JSON: {"titulo":"nombre corto en español","traducido":false,"cortes":[{"tipo":"Hook","texto":"","traduccion":"","mostrar":""}]}`;
}

export async function POST(req: Request) {
  const denied = checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const body = await req.json().catch(() => null);
  const script = typeof body?.script === "string" ? body.script.trim() : "";
  if (script.length < 40) {
    return NextResponse.json({ error: "Pega un guion más largo (al menos un par de frases)." }, { status: 400 });
  }
  if (!textAI.configured()) {
    return NextResponse.json({ error: "Falta ANTHROPIC_API_KEY en Vercel." }, { status: 503 });
  }

  try {
    const answer = parseJSON<CutsAnswer>(await textAI.complete({ prompt: buildPrompt(script, 8), json: true }));
    if (!Array.isArray(answer.cortes) || !answer.cortes.length) throw new Error("La IA no devolvió cortes.");
    return NextResponse.json(answer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo dividir el guion.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
