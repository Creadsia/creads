// Video formats, ported from the prototype (legacy/creads-artifact.html → FORMATS, fmtSplitRules).
// UI copy is Spanish; the rules sent to Claude stay as written in the prototype.

export type FormatId = "ugc" | "faceless" | "antes" | "entrevista" | "podcast" | "noticiero" | "ronda" | "comentario" | "comercial";

export interface Format {
  id: FormatId;
  en: string; // how the format is named in English prompts
  icon: string;
  name: string;
  tag: string;
  /** Avatar: required, optional or none. */
  av: "req" | "opt" | "none";
  avLabel?: string;
  /** Narrated over scenes (voice-over) instead of someone talking on camera. */
  narr?: boolean;
  /** The AI rewrites the script into this format when splitting. */
  adapt?: boolean;
  /** Who can speak in a cut, for adapted formats. */
  speakers?: string[];
  desc: string;
  when: string;
  how: string[];
}

export const FORMATS: Format[] = [
  { id: "ugc", en: "UGC selfie", icon: "🤳", name: "UGC selfie", tag: "Con avatar", av: "req", avLabel: "¿Quién habla?",
    desc: "Una persona real le habla a su celular y cuenta su experiencia.",
    when: "El caballo de batalla: genera confianza y se siente orgánico.",
    how: ["Tu avatar dice el guion exacto a su cámara frontal", "Cada corte cambia de lugar según lo que cuenta", "Se arma con subtítulos tipo TikTok"] },
  { id: "faceless", en: "faceless voiceover b-roll", icon: "🎙️", name: "Voz en off + escenas", tag: "Sin avatar", av: "none", narr: true,
    desc: "Una voz narra el guion mientras se ven escenas reales: grietas, contratistas, la casa.",
    when: "Para testear ángulos rápido, sin depender de una cara.",
    how: ["Eliges una voz de narrador", "La IA crea una escena real por cada frase", "Se unen voz + escenas + subtítulos"] },
  { id: "antes", en: "before and after transformation", icon: "✨", name: "Antes / después", tag: "Sin avatar", av: "none", narr: true,
    desc: "Se ve el problema, el trabajo y el resultado final, con voz en off.",
    when: "Ideal para bath remodel y arreglos visibles.",
    how: ["Primeros cortes: el problema en su peor estado", "Al medio: el equipo trabajando", "Final: el resultado en el mismo lugar"] },
  { id: "entrevista", en: "street interview", icon: "🎤", name: "Entrevista callejera", tag: "2 personas", av: "opt", avLabel: "Dueño de casa (entrevistado)", adapt: true, speakers: ["reporter", "homeowner"],
    desc: "Un reportero con micrófono le pregunta a un dueño de casa en la calle.",
    when: "Engancha porque no parece anuncio.",
    how: ["La IA convierte tu guion en preguntas y respuestas", "El entrevistado cuenta la historia en primera persona", "Cada corte es una sola persona hablando"] },
  { id: "podcast", en: "video podcast", icon: "🎧", name: "Podcast", tag: "2 personas", av: "opt", avLabel: "Invitado", adapt: true, speakers: ["host", "guest"],
    desc: "Dos personas conversando en micrófonos; el invitado cuenta el dato.",
    when: "Da autoridad y genera curiosidad.",
    how: ["La IA convierte el guion en una conversación", "Ángulos de cámara como un podcast real", "El invitado es tu avatar (opcional)"] },
  { id: "noticiero", en: "on-location field news report", icon: "📰", name: "Reportaje en terreno", tag: "Presentador", av: "opt", avLabel: "Reportero", adapt: true, speakers: ["reporter"],
    desc: "Un reportero cuenta la novedad en la calle, frente a las casas.",
    when: "Urgencia y novedad. Sin logos ni canales reales (Meta lo penaliza).",
    how: ["La IA pasa el guion a voz de reportero", "Camarógrafo + micrófono en todos los cortes", "Sin gráficos de noticiero ni logos"] },
  { id: "ronda", en: "handheld roll-call testimonials", icon: "🔁", name: "Ronda de testimonios", tag: "Varias personas", av: "none", adapt: true, speakers: ["voice", "person"],
    desc: "Alguien graba con el celular y le pregunta a varias personas del mismo lugar cuánto pagan o qué les pasó.",
    when: "Prueba social que se acumula: al tercer testimonio ya le crees. Ideal para seguros y ahorro.",
    how: ["Eliges el lugar (car meet, taller, barrio…)", "La IA arma la ronda: una persona distinta por corte", "Quien graba pregunta fuera de cámara; cada persona responde"] },
  { id: "comentario", en: "reply-to-comment UGC", icon: "💬", name: "Respuesta a comentario", tag: "Con avatar", av: "req", avLabel: "¿Quién responde?", adapt: true,
    desc: "Aparece la cajita con la pregunta de un usuario y el avatar responde.",
    when: "Responde la duda número 1 de tu público.",
    how: ["Escribes la pregunta y quién la hizo", "La primera frase responde nombrando a esa persona", "La cajita aparece arriba los primeros segundos"] },
  { id: "comercial", en: "commercial-style video of a presenter filmed by a camera operator", icon: "🎥", name: "Te graban (estilo comercial)", tag: "Con avatar", av: "req", avLabel: "¿Quién habla?",
    desc: "Otra persona graba a tu avatar mientras habla a cámara: varios ángulos y movimiento, como un comercial.",
    when: "Para marcas que quieren verse más producidas sin perder lo cercano. Las manos quedan libres para mostrar el producto.",
    how: ["Tu avatar dice el guion exacto mirando a la cámara", "Cada corte cambia de ángulo: plano medio, cerca, caminando", "Se arma con subtítulos y edición pro"] },
];

export const formatById = (id: string) => FORMATS.find((f) => f.id === id) ?? FORMATS[0];
/** Whether the clips of this format show people (voice-over formats show only scenes). */
export const showsPeople = (id: string) => !formatById(id).narr;
/** One person talks to the camera (UGC, reply to a comment, field report): their lines can be recorded with a chosen voice and lip-synced. */
export const takesOwnVoice = (id: string) => { const f = formatById(id); return !f.narr && (f.speakers?.length ?? 1) <= 1; };
/**
 * Models that refuse photos of real people (Seedance) can't animate an opening frame drawn from the
 * avatar's face, nor one with a person holding the product. Checked before charging anything.
 */
export const refusesFrame = (m: { noFaces?: boolean }, format: string, refs: { face: boolean; product: boolean }) =>
  Boolean(m.noFaces && (refs.face || (refs.product && showsPeople(format))));

export interface SplitOptions {
  format: FormatId;
  cap: number; // max cuts
  comment?: { question: string; user: string };
  ronda?: { place: string; who?: string };
}

/** Extra splitting rules for adapted formats (prototype: fmtSplitRules). */
export function splitRules(o: SplitOptions): string {
  const cap = o.cap;
  const u = o.comment?.user?.trim() || "someone";
  const first = u.split(" ")[0];
  switch (o.format) {
    case "entrevista":
      return `FORMATO: ENTREVISTA CALLEJERA. Convierte el guion en una entrevista corta: el REPORTERO hace preguntas muy breves (máx. 8 palabras, naturales, curiosas) y el DUEÑO DE CASA responde contando la historia del guion en primera persona. Usa TODOS los datos del guion y no inventes ninguno. Escribe "script_en" con el diálogo completo en inglés (sin etiquetas de quién habla). Cada corte es UNA intervención de UNA sola persona y lleva "speaker": "reporter" o "homeowner". Empieza con una pregunta del reportero que enganche. Máximo 3 o 4 preguntas en total; que todo quepa en ${cap} cortes de máximo 15 s.`;
    case "podcast":
      return `FORMATO: CLIP DE PODCAST (como los que se viralizan en Reels/TikTok). Convierte el guion en una conversación entre el CONDUCTOR (host) y el INVITADO (guest), que cuenta la historia del guion en primera persona singular ("I", nunca mezcles "we" e "I").
REGLAS:
1) COLD OPEN: el video parte en la mitad de la conversación con la frase más fuerte o sorprendente del INVITADO (un número, un precio, un giro). NUNCA partas con una pregunta de relleno tipo "so what was that like?".
2) El INVITADO lleva la historia en turnos largos y fluidos. El CONDUCTOR entra máximo 3 veces en todo el video, con reacciones o preguntas de 1 a 5 palabras ("Same day?", "And?", "Did you try it?") o repitiendo un dato con sorpresa.
3) Cubre TODA la historia del guion, en orden, de principio a fin; usa TODOS los datos del guion y no inventes ninguno (ni precios, ni nombres, ni plazos).
4) CIERRE: el CONDUCTOR mira a cámara y dice la llamada a la acción del guion (con sus mismas palabras clave: link, zip, etc.); el INVITADO puede cerrar con una frase corta final.
5) Inglés hablado natural de EE. UU., frases que se dicen fácil en voz alta. Que todo quepa en ${cap} cortes de máximo 15 s (≈ ${cap * 13} s en total).
Escribe "script_en" con el diálogo completo en inglés (sin etiquetas de quién habla). Cada corte es UNA intervención de UNA sola persona y lleva "speaker": "host" o "guest"; en la última intervención del conductor pon en "mostrar": "el conductor mira directo a cámara".`;
    case "noticiero":
      return `FORMATO: REPORTAJE EN TERRENO. Reescribe el guion como lo diría un REPORTERO en la calle contando la historia de los dueños de casa (tercera persona: "homeowners here…", "one family told us…"), con tono de noticia local: claro, directo, con urgencia. Usa TODOS los datos del guion y no inventes ninguno; el cierre es la misma llamada a la acción. Escribe "script_en" con el guion completo resultante. Cada corte lleva "speaker": "reporter".`;
    case "comentario":
      return `FORMATO: RESPUESTA A COMENTARIO. El video responde a este comentario de ${u}: "${o.comment?.question || "(pregunta)"}". Reescribe SOLO la primera frase para que responda directo a esa pregunta nombrando a ${first} (ej: "Okay ${first}, ..."), natural y en inglés de EE. UU.; el resto del guion queda igual palabra por palabra. Escribe "script_en" con el guion completo resultante.`;
    default:
      return "";
  }
}

/** Roll-call testimonials need their own prompt (prototype: rondaSplit). */
export function rondaPrompt(script: string, o: SplitOptions, maxWords: number): string {
  return `Convierte este guion de anuncio en una RONDA DE TESTIMONIOS (formato viral de TikTok/Reels): alguien graba con el celular, camina por un lugar y le pregunta a varias personas distintas; quien graba NUNCA sale en cámara, solo se escucha su voz.
GUION BASE (ángulo, oferta, datos y llamada a la acción):
"""
${script.slice(0, 6000)}
"""
LUGAR: ${o.ronda?.place || "a neighborhood street"}
${o.ronda?.who ? `TIPO DE PERSONAS: ${o.ronda.who}` : ""}
REGLAS:
1) Corte 1 = HOOK: una pregunta corta y curiosa de quien graba (voice) + la respuesta de la primera persona, que sorprende (un giro, un número). Nada de presentaciones.
2) Cada corte es UNA persona distinta del lugar (variada en edad, género y estilo, creíble para ese lugar) que responde con una fórmula que se repite (ej: lo suyo + el número) y agrega UNA frase con emoción propia (un dolor o una reacción distinta en cada uno). Quien graba puede meter preguntas o reacciones cortas (1 a 6 palabras), usando el nombre o apodo de la persona.
3) Último corte: la persona con más autoridad del lugar (el organizador, el dueño, el más veterano) cierra con la llamada a la acción del guion, mirando a cámara.
4) Usa los datos y la oferta del guion; no inventes garantías ni promesas nuevas. Si das montos, que sean coherentes con el guion.
5) Inglés hablado natural de EE. UU., casual y real. Máximo ${o.cap} cortes; cada corte con MÁXIMO ${maxWords} palabras habladas en total (los números cuentan como se dicen).
6) "persona": descripción visual COMPLETA EN INGLÉS de quién sale en ese corte (repítela entera si es la misma persona del corte anterior, nunca escribas "same guy") y lo que lo hace parte del lugar (edad aprox., género, ropa, lo que tiene al lado), sin nombres de marcas de ropa.
Responde SOLO JSON: {"titulo":"nombre corto en español","cortes":[{"tipo":"Hook|Prueba|Dolor|Oferta|CTA","persona":"in English","mostrar":"qué se ve, en español","lineas":[{"speaker":"voice|person","text":"inglés","es":"traducción al español"}]}]}`;
}

/**
 * The formats Creads sells (owner and Benjamín, 21 Oct 2026: back to simple, UGC ads and images). The others
 * stay in the code, hidden, so they can come back without rebuilding them.
 */
export const SOLD_FORMATS: FormatId[] = ["ugc", "comentario", "comercial"];
export const SHOWN_FORMATS = FORMATS.filter((f) => SOLD_FORMATS.includes(f.id));
