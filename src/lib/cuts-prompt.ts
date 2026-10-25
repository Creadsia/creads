import { type AdLang, spokenEs } from "./ad-lang";
import { type FormatId, formatById, splitRules } from "./formats";

// The prompt that splits a script into cuts (/api/cuts). Ported from the prototype's splitScript +
// fmtSplitRules. Kept here (not in the route) so it can be tested.

export interface CutsPromptOptions { format: FormatId; cap: number; maxSec: number; lang: AdLang; comment?: { question: string; user: string } }

export function cutsPrompt(script: string, o: CutsPromptOptions): string {
  const f = formatById(o.format);
  const minW = Math.round(o.maxSec * 1.5), maxW = Math.round(o.maxSec * 2.7);
  const spoken = spokenEs(o.lang);
  const other = o.lang === "en" ? "español" : "inglés";
  const rules = splitRules({ format: o.format, cap: o.cap, comment: o.comment });
  const speakers = f.speakers?.length ? `,"speaker":"${f.speakers.join("|")}"` : "";
  // español neutro: regional slang in the script becomes the neutral word (the accent is the voice's job)
  const neutral = o.lang === "es"
    ? "\n- Español neutro: si el guion trae modismos de un país (por ejemplo «po», «cachai», «al tiro», «bacán», «che», «boludo», «güey», «chido», «vale», «tío», el voseo «tenés/probá»), cámbialos por la palabra neutra equivalente (tú, «ahora mismo», «genial»…) sin tocar nada más; eso no cuenta como traducir."
    : "";
  const titulo = o.lang === "en" ? "short name in English" : "nombre corto en español";
  return `Divide este guion de anuncio en video (formato: ${f.name} · ${f.en}) en CORTES para grabarlo con IA.
GUION:
"""
${script.slice(0, 9000)}
"""
Reglas:
- El video se habla en ${spoken}. Si el guion está en otro idioma, primero pásalo a ese idioma con el mismo sentido ("traducido": true). Si ya está en ese idioma, NO lo reescribas ("traducido": false), salvo lo que pida el formato.${neutral}
- Cada corte dura como máximo ${o.maxSec} segundos: entre ${minW} y ${maxW} palabras habladas, y termina en una pausa natural (fin de frase o de idea).
- Máximo ${o.cap} cortes. Si el guion es más largo, condénsalo sin perder el hook, la oferta ni la llamada a la acción.
- Los cortes van EN ORDEN y juntos cubren todo el guion. "texto" son las palabras exactas que se dicen en ese corte.
- "tipo": Hook, Dolor, Agitación, Mecanismo, Prueba, Oferta, CTA o Transición. El primer corte es el Hook.
- "traduccion": el mismo corte en ${other}, natural.
- "mostrar": qué se ve mientras se dice, en español y concreto (lugar, gesto, objeto).
- "titulo": ${o.lang === "en" ? "en inglés (el anuncio es en inglés)" : "en español"}${o.lang === "es" ? " neutro" : ""}, 2 a 5 palabras.
${f.narr ? "- Es voz en off: nadie habla a cámara; \"mostrar\" describe la escena real que acompaña la frase.\n" : ""}${rules ? `\n${rules}\n(En este formato SÍ puedes reescribir el guion como se indica.)\n` : ""}
Responde SOLO JSON: {"titulo":"${titulo}","traducido":false,"cortes":[{"tipo":"Hook","texto":"","traduccion":"","mostrar":""${speakers}}]}`;
}
