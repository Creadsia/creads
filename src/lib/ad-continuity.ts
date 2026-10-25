import { type AdLang, placeHint } from "./ad-lang";
import { formatById } from "./formats";

// Product fidelity and the same person in every cut of a video ad (owner's end-to-end test, 25 Oct 2026: a
// «STRIDE» shoe ad showed a different shoe in every scene, one of them a real brand's, and without a saved
// avatar the presenter's t-shirt changed colour between cuts).

/** What the image/video model must do with the customer's product photo. */
export const PRODUCT_EXACT =
  "the EXACT product from the product reference image: same shape, proportions, colours, materials, label and logo as in that photo; never redesign, simplify, recolour or swap it, never show any other brand or a different product";

/** What the model must do when nobody gave a product photo: nothing that looks like a real brand. */
export const PRODUCT_GENERIC =
  "If a product appears, it is a plain unbranded generic one: no logos, brand names, brand stripes, swooshes, monograms or any recognizable design of a real brand.";

/** The phrase that points the frame model at the first reference image (the person). */
export const PERSON_REF = "The person from the first reference image (same face, hair and clothes)";
const TWO_REFS = "(The first reference image is the person, the second one is the product.)";
const ONE_REF = "(The reference image is the product.)";

/** Formats where one presenter (or one interviewee/guest/reporter) appears in every cut. */
export function personaWanted(format: string): boolean {
  const f = formatById(format);
  return !f.narr && format !== "ronda";
}

// ---------- «Persona del anuncio»: a fixed person and outfit when the ad has no saved avatar ----------

const hash = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };

const NOT_ADJ = new Set(["una", "uno", "nada", "toda", "todo", "otra", "otro", "como", "casa", "para", "mucho", "poco", "mucha", "poca", "esta", "este", "esto", "aquí", "acá", "allá", "solo", "sola", "fuera", "afuera", "buena", "bueno"]);

/** Who is speaking, from the script's own words ("" when it doesn't say). */
export function scriptGender(script: string): "female" | "male" | "" {
  const t = ` ${script.toLowerCase()} `;
  let f = 0, m = 0;
  // Spanish: «estoy cansada», «me siento segura», «quedé encantada»; English: "my husband", "as a mom"
  for (const x of t.matchAll(/\b(?:estoy|estaba|soy|era|quedé|me siento|me sentía|me sentí|ando|vivía|estuve)\s+(?:muy\s+|tan\s+|súper\s+|re\s+)?([a-záéíóúñ]{3,})\b/g)) {
    if (NOT_ADJ.has(x[1])) continue;
    if (/a$/.test(x[1]) && !/(?:ista|ita|ma|ía)$/.test(x[1])) f++;
    else if (/o$/.test(x[1])) m++;
  }
  f += (t.match(/\b(embarazada|mamá|mami|mi marido|mi esposo|mi pololo|mi novio|como mujer|my husband|my boyfriend|as a mom|as a woman|pregnant)\b/g) ?? []).length * 2;
  m += (t.match(/\b(papá|mi señora|mi esposa|mi polola|mi novia|como hombre|my wife|my girlfriend|as a dad|as a man)\b/g) ?? []).length * 2;
  return f > m ? "female" : m > f ? "male" : "";
}

const LOOKS = {
  female: [
    "about 28, long dark brown wavy hair, warm brown eyes",
    "about 34, shoulder-length straight black hair tied in a low ponytail, light makeup",
    "about 40, chin-length chestnut bob, friendly smile lines",
    "about 25, curly dark hair worn loose, small gold hoop earrings",
  ],
  male: [
    "about 30, short dark hair, trimmed short beard",
    "about 37, short black hair with a side part, clean-shaven",
    "about 45, short salt-and-pepper hair, light stubble",
    "about 26, short curly dark hair, clean-shaven",
  ],
};
// one plain colour, no print and no logo: the easiest outfit for the models to keep identical
const TOPS = [
  "a plain olive-green crew-neck t-shirt", "a plain mustard-yellow crew-neck t-shirt", "a plain light-grey hoodie",
  "a plain white button-up shirt with the sleeves rolled up", "a plain terracotta crew-neck sweater", "a plain light-blue denim shirt",
];

/**
 * The automatic presenter of an ad without an avatar: one exact person and outfit (in English, for the
 * models), the same for the whole ad. The seed (the job id) keeps it stable across steps and redos.
 */
export function autoPersona(seed: string, lang: AdLang, script: string): string {
  const h = hash(seed || script);
  const gender = scriptGender(script) || (h % 2 ? "female" : "male");
  const looks = LOOKS[gender];
  const who = lang === "en" ? "American" : lang === "es-CL" ? "Chilean" : "Latin American";
  const top = TOPS[(h >>> 3) % TOPS.length];
  return `a ${who} ${gender === "female" ? "woman" : "man"} ${looks[(h >>> 1) % looks.length]}, wearing ${top} (no print, no logo) and nothing on top of it; exactly this same person, hair and outfit in every cut`;
}

// ---------- first frames (models that animate a still) ----------

export interface FrameOpts {
  /** The first reference image is the person (a saved avatar, or the first cut's frame of the automatic person). */
  personRef?: boolean;
  /** Who the person is (avatar or automatic person description). */
  person?: string;
  /** The customer's product photo comes as a reference image (after the person's, if any). */
  product?: boolean;
}

/** The first-frame prompt of an API / Automático ad cut. */
export function adFramePrompt(dir: { setting?: string; framing?: string } | undefined, lang: AdLang, o: FrameOpts = {}): string {
  const who = o.personRef ? ` ${PERSON_REF}${o.person ? `: ${o.person}` : ""}.` : o.person ? ` The person: ${o.person}.` : "";
  const product = o.product
    ? ` The product is clearly visible, held by the person or right next to them: ${PRODUCT_EXACT}. ${o.personRef ? TWO_REFS : ONE_REF}`
    : ` ${PRODUCT_GENERIC}`;
  const hint = placeHint(lang);
  return `Photorealistic 9:16 still frame, the first frame of a real phone video clip (not a staged photo).${who} Setting: ${dir?.setting || "a real place, natural light"} (show the place exactly as this setting says it is now, even if the reference image shows it damaged or unfinished). Shot: ${dir?.framing || "handheld selfie, chest-up"}. A natural relaxed expression, mouth closed, the instant before speaking.${product}${hint ? ` ${hint}` : ""} Natural light, real skin texture, no added text, no watermark${o.product ? ", no logos other than the product's own label exactly as in its photo" : ", no logos"}.`;
}

/** The frame prompt when the person's reference image couldn't be had (the first cut never drew one). */
export const withoutPersonRef = (prompt: string) =>
  prompt.replace(`${PERSON_REF}: `, "The person: ").replace(` ${PERSON_REF}.`, "").replace(TWO_REFS, ONE_REF);

/** The first cut's frame prompt when it's drawn again and another cut's frame can be its reference. */
export const withPersonRef = (prompt: string) =>
  prompt.includes(PERSON_REF) ? prompt : prompt.replace(" The person: ", ` ${PERSON_REF}: `).replace(ONE_REF, TWO_REFS);

/**
 * Whether a cut of an ad without an avatar uses the automatic person: its first cut's frame becomes the face
 * reference of every later cut. Not for animated stories, «Avatar que habla», «Persona real», or models that
 * refuse pictures of people (Seedance): those keep their own path.
 */
export function usesPersona(o: { persona: boolean; face: boolean; story: boolean; talking: boolean; actor: boolean; noFaces: boolean }): boolean {
  return o.persona && !o.face && !o.story && !o.talking && !o.actor && !o.noFaces;
}
