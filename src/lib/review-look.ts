// The visual part of the automatic quality review (/api/review): one still of each finished cut, looked at
// together by the vision model, plus the customer's product photo when the ad has one. Pure functions here
// (the prompt and the severity decisions), so they can be tested without spending anything.

export type LookKind = "producto" | "persona" | "cuerpo" | "otro";
export interface LookFinding { corte: number; tipo?: string; problema: string; grave?: boolean; claro?: boolean }
export interface LookTarget { issues: string[]; severe: boolean; look?: string; redraw?: boolean; idx: number }

export interface LookContext {
  formatName: string;
  format: string;
  /** Two people on camera (entrevista, podcast). */
  twoPeople: boolean;
  /** Voice-over: nobody should talk on camera. */
  narr: boolean;
  /** What each cut says, in order. */
  texts: string[];
  /** The customer's product photo is the LAST image. */
  hasProduct: boolean;
}

/** The instruction for the vision model. Images: one still per cut in order, then the product photo (if any). */
export function lookPrompt(c: LookContext): string {
  const n = c.texts.length;
  const sameness = c.format === "ronda"
    ? "Es una RONDA: a propósito sale una persona distinta en cada corte. Revisa que el lugar, la hora del día y la luz sean el mismo ambiente."
    : c.twoPeople ? "Aparecen dos personas: cada una debe verse igual (cara, pelo, ropa) en todos los cortes."
      : c.narr ? "Es voz en off: nadie debería hablar a cámara."
        : "Debe ser la MISMA persona, con la MISMA ropa, en todos los cortes.";
  const people = c.format === "ronda" || c.narr ? "" : `
PERSONA Y ROPA (tipo "persona"): compara cada corte con el ANTERIOR y con el corte 1. Marca el corte donde la persona o su ropa cambia: otra cara, otro pelo, otra prenda u otro color de ropa. "claro": true solo si se nota sin dudar (otra persona, una polera de otro color, otra prenda); false si es solo luz, ángulo, encuadre o una duda. Si cambia, marca el corte que se aparta del resto (no el corte 1, salvo que el corte 1 sea el distinto).`;
  const product = c.hasProduct ? `
PRODUCTO (tipo "producto"): la ÚLTIMA imagen (imagen ${n + 1}) NO es un corte: es la foto del producto real del cliente. En cada corte donde se ve un producto, revisa que sea ESE MISMO producto (forma, colores, etiqueta, logo). Si se ve otro producto, otra marca u otro diseño, márcalo con tipo "producto" y grave true. Si en el corte no se ve ningún producto, no lo marques.` : `
MARCAS: no hay foto del producto; si se ve el logo o el diseño reconocible de una marca real (por ejemplo las rayas o el logo de una marca de zapatillas), márcalo con tipo "otro" y grave true.`;
  const body = c.narr ? "" : `
CUERPO (tipo "cuerpo"): cuenta los brazos, las manos y las cabezas de cada persona. Márcalo si hay un brazo o una mano de más (por ejemplo una mano que sale de la nada mientras la otra sostiene el celular), dedos de más o pegados, una cabeza o cara doble, brazos o piernas doblados al revés, o un cuerpo deforme o derretido. Pon "grave": true y "claro": true si se ve sin dudar; "claro": false si es solo borroso por movimiento o no se alcanza a ver.`;
  return `Eres el editor de un anuncio en video hecho con IA (formato: ${c.formatName}). Las imágenes son una foto del medio de cada corte, en orden (imagen 1 = corte 1).
LO QUE DICE CADA CORTE:
${c.texts.map((t, i) => `CORTE ${i + 1}: "${t}"`).join("\n")}
${sameness}${people}${body}${product}
OTROS (tipo "otro"): busca SOLO errores OBVIOS que un espectador notaría: texto, logos o números legibles en pantalla; algo que contradice lo que dice el corte; formato equivocado (por ejemplo una selfie cuando debería ser con camarógrafo).
"grave": true solo si vale la pena rehacer el corte.
Responde SOLO JSON: {"cortes":[{"corte":número,"tipo":"persona|cuerpo|producto|otro","problema":"en español, corto","grave":true,"claro":true}]} (lista vacía si no hay errores).`;
}

export const lookKind = (t: unknown): LookKind => (t === "producto" || t === "persona" || t === "cuerpo" ? t : "otro");

/**
 * Applies what the vision model found to each cut's review. Severity:
 * - «otro producto» (only when the customer gave a product photo): always severe, and the first frame is
 *   drawn again (the old one has the wrong product).
 * - «la persona o la ropa cambia»: severe only when clearly different (grave AND claro); never in a «ronda».
 *   The frame is drawn again, except on the first cut when the automatic person comes from it.
 * - «cuerpo» (an extra arm or hand, a double face, a deformed body): severe whenever it is clear (claro) or the
 *   model calls it grave; the first frame is drawn again too, because the extra arm often comes from it.
 * - anything else: severe when the model says it's worth redoing.
 * `targets[i]` is the cut shown as image i+1.
 */
export function applyLook(targets: LookTarget[], found: LookFinding[], o: { hasProduct: boolean; format: string; personaFromFirst?: boolean }): void {
  for (const x of found ?? []) {
    const r = targets[Number(x?.corte) - 1];
    const problema = typeof x?.problema === "string" ? x.problema.trim() : "";
    if (!r || !problema) continue;
    const kind = lookKind(x.tipo);
    if (kind === "producto" && !o.hasProduct) continue; // no photo to compare with: the model guessed
    if (kind === "persona" && o.format === "ronda") continue; // a different person each cut, on purpose
    const label = kind === "producto" ? `producto distinto: ${problema}` : kind === "persona" ? `la ropa o la persona cambia entre escenas: ${problema}` : kind === "cuerpo" ? `cuerpo raro: ${problema}` : problema;
    r.look = r.look ? `${r.look}; ${label}` : label;
    r.issues.push(`imagen: ${label}`);
    const severe = kind === "producto" ? true : kind === "persona" ? x.grave === true && x.claro === true : kind === "cuerpo" ? x.grave === true || x.claro === true : x.grave === true;
    if (!severe) continue;
    r.severe = true;
    if (kind === "producto" || ((kind === "persona" || kind === "cuerpo") && !(o.personaFromFirst && r.idx === 0))) r.redraw = true;
  }
}
