// Generador de guiones: take a winning script apart, learn why it works and iterate to a better one.
// Shared by the API (prompts) and the studio (labels, colors, lessons). The prompts carry the
// prototype's "Jordan" direct-response method (10 hook types, 10% better per line, no invented facts).

export type ScriptLang = "es-CL" | "en";
/** sessionStorage key: a script handed from the Generador to "Crear anuncio". */
export const TO_CREAR_KEY = "creads-guion-to-crear";
export const SCRIPT_LANGS: { id: ScriptLang; label: string; spoken: string }[] = [
  { id: "es-CL", label: "Español (Chile)", spoken: "español de Chile hablado y natural (chileno, sin exagerar modismos), tuteando" },
  { id: "en", label: "Inglés (EE. UU.)", spoken: "natural spoken US English, the way a real person says it to camera" },
];

/** The building blocks of a direct-response ad script, with a lesson for each. */
export const BLOCKS = [
  { id: "Hook", color: "#f59e0b", what: "Las primeras palabras: detienen el scroll en 1–3 segundos.", ask: "¿Alguien de mi público dejaría de mover el dedo al escuchar esto?", good: "«Si tu casa tiene esta grieta en la pared, no la tapes con pintura.»", bad: "«Hola, hoy les quiero hablar de cimientos.»" },
  { id: "Dolor", color: "#ef4444", what: "El problema que la persona ya siente, dicho con sus palabras.", ask: "¿Mi cliente diría esta frase en voz alta?", good: "«Cada vez que llueve, la puerta del baño ya no cierra.»", bad: "«Los problemas estructurales afectan a muchas viviendas.»" },
  { id: "Agitación", color: "#f97316", what: "Lo que pasa si no hace nada: hace que el dolor importe hoy.", ask: "¿Queda claro qué pierde si espera?", good: "«En seis meses esa grieta cuesta el triple de arreglar.»", bad: "«Es importante considerar este tema.»" },
  { id: "Mecanismo", color: "#8b5cf6", what: "Por qué esta solución funciona (o es más barata) cuando otras no.", ask: "¿Explica el «cómo» de forma simple y creíble?", good: "«Usan pilotes de acero que llegan a suelo firme, sin romper el piso.»", bad: "«Tenemos la mejor tecnología del mercado.»" },
  { id: "Prueba", color: "#10b981", what: "Por qué creerte: resultados, testimonios, números, autoridad.", ask: "¿Hay algo concreto que se pueda comprobar?", good: "«A mi vecina se lo hicieron en dos días y le salió la mitad.»", bad: "«Somos los mejores, confía en nosotros.»" },
  { id: "Oferta", color: "#06b6d4", what: "Lo que recibe y en qué condiciones (inspección gratis, descuento, bono).", ask: "¿Se entiende exactamente qué se lleva?", good: "«La inspección es gratis y te dan el presupuesto por escrito.»", bad: "«Tenemos buenas ofertas.»" },
  { id: "Urgencia", color: "#e11d48", what: "Por qué actuar ahora y no la próxima semana (real, no inventada).", ask: "¿La razón para apurarse es creíble?", good: "«Solo están tomando inspecciones en tu zona este mes.»", bad: "«¡¡Últimos cupos!!» sin ninguna razón." },
  { id: "CTA", color: "#3b82f6", what: "Qué hacer exactamente: un solo paso, fácil.", ask: "¿Hay una sola acción clara?", good: "«Toca el botón y pide tu inspección gratis.»", bad: "«Llámanos, visítanos o escríbenos cuando quieras.»" },
  { id: "Transición", color: "#64748b", what: "Una frase puente que une dos bloques y mantiene el ritmo.", ask: "¿Empuja a escuchar la siguiente frase?", good: "«Y aquí viene lo que nadie te cuenta…»", bad: "«Bueno, eh, otra cosa…»" },
] as const;
export type BlockId = (typeof BLOCKS)[number]["id"];
export const blockOf = (id: string) => BLOCKS.find((b) => b.id.toLowerCase() === String(id).toLowerCase()) ?? BLOCKS[BLOCKS.length - 1];

export const HOOK_TYPES = "pregunta directa · advertencia o estafa · precio o número concreto · historia personal · POV · curiosidad o secreto · contraintuitivo · llamada al público («Dueños de casa de más de 50…») · urgencia temporal · prueba social";

export type Mode = "desarmar" | "angulos" | "hooks" | "mejorar" | "idea" | "duraciones" | "crear";

export const MODES: { id: Mode; title: string; short: string; needsScript: boolean }[] = [
  { id: "desarmar", title: "Desarmar el guion", short: "Lo separa en hook, dolor, urgencia, CTA… y te explica por qué funciona y qué mejorar.", needsScript: true },
  { id: "angulos", title: "3 ángulos nuevos", short: "La misma oferta contada desde 3 ángulos distintos, listos para testear.", needsScript: true },
  { id: "hooks", title: "10 hooks", short: "Diez aperturas de tipos distintos, con puntaje, para cambiar solo el inicio.", needsScript: true },
  { id: "mejorar", title: "Mejorar cada línea", short: "Reescribe cada frase un 10% mejor y te muestra qué cambió y por qué.", needsScript: true },
  { id: "idea", title: "Probar una idea", short: "«¿Y si el hook habla del vecino?» La IA la aplica y te dice si suma.", needsScript: true },
  { id: "duraciones", title: "Versiones de 15, 30 y 45 s", short: "El mismo guion en tres largos, sin perder hook ni CTA.", needsScript: true },
  { id: "crear", title: "Crear desde cero", short: "Sin guion: describes qué vendes y a quién, y recibes 3 guiones.", needsScript: false },
];

export interface Block { tipo: string; texto: string; es?: string; para_que?: string; nota?: number; mejora?: string }
export interface ScriptOut { titulo: string; angulo?: string; por_que?: string; bloques: Block[]; segundos?: number; puntaje?: number; cuando?: string }
export interface Analysis {
  titulo: string;
  puntaje: number;
  resumen: string;
  palanca: string;
  angulo: string;
  publico: string;
  conciencia: string;
  emocion: string;
  tipo_hook: string;
  estructura: string;
  bloques: Block[];
  fortalezas: string[];
  mejoras: string[];
  riesgos: string[];
  ideas: string[];
}
export interface Hook { texto: string; es?: string; tipo: string; nota: number; por_que?: string }

export interface GuionAnswer {
  analysis?: Analysis;
  scripts?: ScriptOut[];
  hooks?: Hook[];
  resumen?: string;
  antes?: number;
  despues?: number;
}

export interface GuionRequest {
  mode: Mode;
  script: string;
  lang: ScriptLang;
  niche?: string;
  context?: string; // what they sell, offer, audience (optional; required for "crear")
  idea?: string; // for "idea"
  level?: "fiel" | "max"; // for "mejorar"
}

const HARD_RULES = (lang: ScriptLang) => `Reglas duras:
- Escribe los guiones en ${SCRIPT_LANGS.find((l) => l.id === lang)!.spoken}. Frases cortas, fáciles de decir en voz alta a cámara.
- NO inventes precios, números, porcentajes, garantías, plazos, nombres, marcas ni testimonios que no estén en el material. Si falta un dato, usa una frase que funcione sin él.
- Nada que Meta rechace: no prometas resultados garantizados, no afirmes atributos personales del que mira («¿Tienes deudas?» está bien; «Sé que estás endeudado» no), nada engañoso.
- Cada bloque tiene "tipo" (uno de: Hook, Dolor, Agitación, Mecanismo, Prueba, Oferta, Urgencia, CTA, Transición), "texto" (lo que se dice)${lang === "en" ? ', "es" (traducción al español)' : ""}. El primero es Hook y el último es CTA.`;

const material = (r: GuionRequest) => `${r.niche ? `NICHO: ${r.niche}\n` : ""}${r.context?.trim() ? `CONTEXTO DEL CLIENTE (qué vende, oferta, público): ${r.context.trim().slice(0, 1500)}\n` : ""}${r.script.trim() ? `GUION GANADOR:\n"""\n${r.script.trim().slice(0, 8000)}\n"""\n` : ""}`;

const ROLE = "Eres el mejor creative strategist y copywriter de respuesta directa para anuncios en video (UGC, a cámara) de Meta y TikTok, especialista en generación de leads. Explicas en español simple, como un buen profesor, para que alguien sin experiencia aprenda.";

const blockJson = (lang: ScriptLang) => `{"tipo":"Hook","texto":"…"${lang === "en" ? ',"es":"…"' : ""}}`;

/** The prompt for one action. Answer is always JSON. */
export function guionPrompt(r: GuionRequest): string {
  const m = material(r);
  const L = r.lang;
  switch (r.mode) {
    case "desarmar":
      return `${ROLE}
Desarma este guion para enseñarle al usuario cómo está construido y qué puede mejorar.
${m}
Para cada parte del guion (en orden, cubriendo TODO el texto, sin cambiar las palabras), indica el bloque y explica para qué sirve.
- "nota": 1 a 10, qué tan bien cumple su función ese bloque.
- "mejora": una sugerencia concreta y corta (o "" si está perfecto).
Diagnóstico general: palanca principal (la emoción o motivo que mueve a actuar), ángulo, a quién le habla, nivel de conciencia (inconsciente / consciente del problema / consciente de la solución / consciente del producto / muy consciente), emoción dominante, tipo de hook (${HOOK_TYPES}), estructura (p. ej. Hook → Dolor → Mecanismo → Oferta → CTA).
Todo el análisis en español. Los "texto" de los bloques van tal cual están en el guion original${L === "en" ? ' y agrega "es" con la traducción al español si el guion no está en español' : ""}.
Responde SOLO JSON: {"analysis":{"titulo":"nombre corto","puntaje":1-10,"resumen":"2-3 frases: qué hace bien y qué lo frena","palanca":"","angulo":"","publico":"","conciencia":"","emocion":"","tipo_hook":"","estructura":"","bloques":[{"tipo":"Hook","texto":"","es":"","para_que":"qué logra esta parte, 1 frase","nota":8,"mejora":""}],"fortalezas":["3 a 5"],"mejoras":["3 a 5, concretas y accionables"],"riesgos":["riesgos de políticas de Meta o de leads de mala calidad; [] si no hay"],"ideas":["3 a 5 ideas para testear variaciones"]}}`;
    case "angulos":
      return `${ROLE}
Escribe 3 guiones nuevos que vendan LO MISMO (misma oferta y mismo CTA) desde 3 ÁNGULOS claramente distintos (por ejemplo: miedo a perder, ahorro, estatus/orgullo, comodidad, rabia contra el enemigo común, historia de alguien parecido, curiosidad). Mantén el largo parecido al original.
${m}
${HARD_RULES(L)}
Para cada guion: "angulo" (nombre corto), "por_que" (por qué podría ganarle al original, 1-2 frases en español), "cuando" (cuándo conviene testearlo, 1 frase), "puntaje" 1-10, "segundos" aproximados.
Responde SOLO JSON: {"scripts":[{"titulo":"","angulo":"","por_que":"","cuando":"","puntaje":8,"segundos":30,"bloques":[${blockJson(L)}]}]}`;
    case "hooks":
      return `${ROLE}
Escribe 10 hooks (las primeras 1-2 frases) para reemplazar el inicio de este guion. Cada uno de un tipo distinto: ${HOOK_TYPES}. Deben conectar con el resto del guion sin cambiarlo.
${m}
${HARD_RULES(L)}
Puntúa cada hook 1-10 por: detener el scroll en el primer segundo, claridad, curiosidad y especificidad. Ordénalos de mejor a peor.
Responde SOLO JSON: {"hooks":[{"texto":"",${L === "en" ? '"es":"traducción",' : ""}"tipo":"tipo en español","nota":9,"por_que":"por qué funciona, 1 frase"}]}`;
    case "mejorar":
      return `${ROLE}
Lleva este guion a su mejor versión. ${r.level === "max" ? "MODO LIBRE: puedes cambiar estructura, orden, ángulo y palabras, mientras se venda lo mismo con el mismo CTA." : "MODO FIEL: mantén la historia, el orden y la estructura; mejora cada frase un 10%: más específica, más creíble, más emocional, más fácil de decir."}
Proceso interno: 1) piensa 10 hooks de tipos distintos y usa el mejor; 2) reescribe cada bloque; 3) léelo de corrido como la persona que lo dice a cámara y corrige ritmo y coherencia.
${m}
${HARD_RULES(L)}
En cada bloque agrega "mejora": qué cambiaste y por qué, 1 frase en español (o "" si quedó igual).
Responde SOLO JSON: {"antes":1-10,"despues":1-10,"resumen":"qué cambiaste y por qué, 2-3 frases en español","scripts":[{"titulo":"","segundos":30,"puntaje":9,"bloques":[{"tipo":"Hook","texto":""${L === "en" ? ',"es":""' : ""},"mejora":""}]}]}`;
    case "idea":
      return `${ROLE}
El usuario quiere probar esta idea sobre el guion: «${(r.idea ?? "").trim().slice(0, 600)}».
Aplícala de la mejor forma posible y escribe el guion completo con la idea. Después evalúa con honestidad si suma o resta (puntaje antes y después).
${m}
${HARD_RULES(L)}
Responde SOLO JSON: {"antes":1-10,"despues":1-10,"resumen":"si la idea suma o no y por qué, 2-3 frases en español; si no suma, sugiere cómo aprovecharla mejor","scripts":[{"titulo":"","segundos":30,"bloques":[${blockJson(L)}]}]}`;
    case "duraciones":
      return `${ROLE}
Escribe 3 versiones de este guion: de unos 15, 30 y 45 segundos (≈ 2,5 palabras por segundo). La de 15 s conserva solo Hook, la idea central y CTA; la de 45 s puede sumar prueba u objeciones. Nunca pierdas el hook ni el CTA.
${m}
${HARD_RULES(L)}
Responde SOLO JSON: {"scripts":[{"titulo":"Versión 15 s","segundos":15,"por_que":"qué se quitó o se agregó, 1 frase","bloques":[${blockJson(L)}]},{"titulo":"Versión 30 s","segundos":30,"por_que":"","bloques":[]},{"titulo":"Versión 45 s","segundos":45,"por_que":"","bloques":[]}]}`;
    case "crear":
      return `${ROLE}
Crea 3 guiones de anuncio en video de unos 30 segundos desde cero, cada uno con un ángulo y un tipo de hook distinto, con la estructura que mejor funcione (Hook → Dolor → Agitación/Mecanismo → Prueba/Oferta → Urgencia → CTA, ajustando según el caso).
${m}
${HARD_RULES(L)}
Para cada guion: "angulo", "por_que" (por qué funciona, 1-2 frases), "cuando" (cuándo testearlo), "puntaje" 1-10, "segundos".
Responde SOLO JSON: {"scripts":[{"titulo":"","angulo":"","por_que":"","cuando":"","puntaje":8,"segundos":30,"bloques":[${blockJson(L)}]}]}`;
  }
}

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const num = (v: unknown) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(10, Math.max(1, n)) : 0; };
const list = (v: unknown, n = 6) => (Array.isArray(v) ? v.map((x) => str(x, 300)).filter(Boolean).slice(0, n) : []);

function tidyBlocks(v: unknown): Block[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((b) => ({ tipo: blockOf(str(b?.tipo, 30)).id, texto: str(b?.texto, 1200), es: str(b?.es, 1200) || undefined, para_que: str(b?.para_que, 300) || undefined, nota: num(b?.nota) || undefined, mejora: str(b?.mejora, 300) || undefined }))
    .filter((b) => b.texto)
    .slice(0, 20);
}

function tidyScript(v: Record<string, unknown>): ScriptOut | null {
  const bloques = tidyBlocks(v?.bloques);
  if (!bloques.length) return null;
  return { titulo: str(v?.titulo, 80) || "Guion", angulo: str(v?.angulo, 80) || undefined, por_que: str(v?.por_que, 400) || undefined, cuando: str(v?.cuando, 300) || undefined, puntaje: num(v?.puntaje) || undefined, segundos: Number(v?.segundos) > 0 ? Math.round(Number(v.segundos)) : undefined, bloques };
}

/** Keeps only well-formed parts of the model's answer (never trusts its shape). */
export function tidyAnswer(mode: Mode, raw: Record<string, unknown>): GuionAnswer {
  if (mode === "desarmar") {
    const a = (raw?.analysis ?? raw) as Record<string, unknown>;
    const bloques = tidyBlocks(a?.bloques);
    if (!bloques.length) return {};
    return {
      analysis: {
        titulo: str(a.titulo, 80) || "Tu guion", puntaje: num(a.puntaje), resumen: str(a.resumen), palanca: str(a.palanca, 200), angulo: str(a.angulo, 200), publico: str(a.publico, 200),
        conciencia: str(a.conciencia, 120), emocion: str(a.emocion, 120), tipo_hook: str(a.tipo_hook, 120), estructura: str(a.estructura, 300),
        bloques, fortalezas: list(a.fortalezas), mejoras: list(a.mejoras), riesgos: list(a.riesgos), ideas: list(a.ideas),
      },
    };
  }
  if (mode === "hooks") {
    const hooks = (Array.isArray(raw?.hooks) ? raw.hooks : [])
      .map((h: Record<string, unknown>) => ({ texto: str(h?.texto, 400), es: str(h?.es, 400) || undefined, tipo: str(h?.tipo, 60), nota: num(h?.nota), por_que: str(h?.por_que, 300) || undefined }))
      .filter((h: Hook) => h.texto)
      .sort((a: Hook, b: Hook) => b.nota - a.nota)
      .slice(0, 12);
    return { hooks };
  }
  const scripts = (Array.isArray(raw?.scripts) ? raw.scripts : []).map((s: Record<string, unknown>) => tidyScript(s)).filter(Boolean).slice(0, 4) as ScriptOut[];
  return { scripts, resumen: str(raw?.resumen) || undefined, antes: num(raw?.antes) || undefined, despues: num(raw?.despues) || undefined };
}

/** The script as plain text (what goes to "Crear anuncio"). */
export const scriptText = (blocks: Block[]) => blocks.map((b) => b.texto.trim()).filter(Boolean).join("\n");
/** Rough length when spoken (≈ 2.5 words per second). */
export const spokenSeconds = (text: string) => Math.max(1, Math.round(text.trim().split(/\s+/).filter(Boolean).length / 2.5));
