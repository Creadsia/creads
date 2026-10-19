import { findImage } from "./providers";
import { mediaRefOf, mediaSaved, saveMedia } from "./media";

// «Avatares de Creads»: ready-made presenters for people who don't want to create one. All are invented
// people (never a real or famous person), drawn once by Creads (the Guardián's ping fills in any missing
// picture, a few at a time) and kept in Creadsia's own storage. A customer who picks one gets a copy in
// their own account, like any avatar they made.

export interface PresetAvatar {
  id: string;
  name: string;
  /** Shown to the customer. */
  que: string;
  /** What the video prompts use (English, like the avatars people make). */
  description: string;
  lang: "es-CL" | "es" | "en";
}

export const PRESETS: PresetAvatar[] = [
  { id: "valentina", name: "Valentina", que: "28 años · cercana y fresca · estilo de vida, belleza, apps", description: "Chilean woman, about 28, wavy chestnut shoulder-length hair, warm brown eyes, white t-shirt, small gold hoops, friendly", lang: "es-CL" },
  { id: "matias", name: "Matías", que: "32 años · seguro y relajado · tecnología, finanzas, servicios", description: "Latin American man, about 32, short dark hair, trimmed short beard, gray hoodie, confident and relaxed", lang: "es-CL" },
  { id: "carmen", name: "Carmen", que: "55 años · confiable y cálida · salud, seguros, hogar", description: "Latin American woman, about 55, short silver-gray hair, thin reading glasses, light blue blouse, warm and trustworthy", lang: "es" },
  { id: "raul", name: "Don Raúl", que: "62 años · tranquilo y sabio · seguros, jubilación, hogar", description: "Latin American man, about 62, gray hair and gray mustache, plaid flannel shirt, kind and calm", lang: "es-CL" },
  { id: "camila", name: "Camila", que: "24 años · divertida · belleza, moda, apps", description: "Latin American young woman, about 24, long straight black hair, light natural makeup, oversized beige sweater, playful", lang: "es" },
  { id: "diego", name: "Diego", que: "26 años · curioso · tecnología, gaming, cursos", description: "Latin American young man, about 26, curly dark hair, black t-shirt, easygoing and curious", lang: "es" },
  { id: "fernanda", name: "Fernanda", que: "35 años · profesional · empresas, finanzas, educación", description: "Latin American professional woman, about 35, dark hair in a low ponytail, beige blazer over a white top, confident", lang: "es" },
  { id: "andres", name: "Andrés", que: "40 años · serio y amable · finanzas, seguros, inmobiliaria", description: "Latin American man, about 40, short brown hair graying at the temples, clean shaven, light blue button-up shirt, calm", lang: "es" },
  { id: "lucia", name: "Lucía", que: "33 años · mamá práctica · alimentos, hogar, niños", description: "Latin American woman, about 33, brown hair in a messy bun, striped apron over a green t-shirt, warm and practical", lang: "es" },
  { id: "javier", name: "Javier", que: "45 años · enérgico · fitness, salud, suplementos", description: "Latin American man, about 45, fit, very short hair, black sports t-shirt, energetic", lang: "es" },
  { id: "sofia", name: "Sofía", que: "21 años · estudiante · educación, apps, ofertas", description: "Latin American young woman, about 21, light brown hair with bangs, denim jacket, cheerful student", lang: "es" },
  { id: "martina", name: "Martina", que: "38 años · directa · servicios, autos, seguros", description: "Latin American woman, about 38, tan skin, curly dark hair, black top, direct and warm, filming a selfie in her parked car", lang: "es" },
  { id: "tomas", name: "Tomás", que: "29 años · trabajador · oficios, herramientas, autos", description: "Latin American man, about 29, short black hair, navy work overalls, friendly hard worker in a workshop", lang: "es-CL" },
  { id: "rosa", name: "Abuela Rosa", que: "68 años · sonriente y tierna · salud, hogar, familia", description: "Latin American grandmother, about 68, short white hair, black-rimmed glasses, red lipstick, big warm smile, cardigan", lang: "es" },
  { id: "emily", name: "Emily", que: "30 años · inglés · lifestyle, belleza, apps (EE.UU.)", description: "American woman, about 30, blonde hair in a ponytail, light gray hoodie, friendly and natural", lang: "en" },
  { id: "marcus", name: "Marcus", que: "35 años · inglés · finanzas, fitness, tecnología (EE.UU.)", description: "African American man, about 35, short hair and short beard, denim shirt, confident and warm", lang: "en" },
];

const SETTING: Record<string, string> = {
  valentina: "bright modern living room with plants", matias: "modern home kitchen", carmen: "cozy dining room with warm lamp light",
  raul: "backyard patio with potted plants, late afternoon", camila: "bedroom with warm string lights, evening", diego: "home desk with a monitor and soft colored light",
  fernanda: "bright office with glass walls", andres: "home office with bookshelves", lucia: "family kitchen", javier: "small gym",
  sofia: "university café", martina: "inside her parked car, daylight through the window", tomas: "mechanic workshop",
  rosa: "cozy living room with family photos", emily: "American suburban kitchen", marcus: "modern living room",
};

export const presetById = (id: unknown) => PRESETS.find((p) => p.id === id) ?? null;
const fileOf = (id: string) => `${id}.png`;
export const presetRef = (id: string) => mediaRefOf("main", "presets", fileOf(id));

export function presetPrompt(p: PresetAvatar) {
  return `Photorealistic smartphone photo, chest-up portrait of an ordinary, non-famous person: ${p.description}. Looking straight at the camera with a relaxed natural smile, mouth closed, as if about to start talking in a selfie video. Setting: ${SETTING[p.id] ?? "a real home"}, softly blurred. Natural light, real skin texture, no beauty filter, sharp focus on the face. No text, no logos, no watermark.`;
}

// which pictures exist, remembered for a few minutes per server
let readyCache: { at: number; ids: Set<string> } | null = null;
export async function readyPresets(): Promise<Set<string>> {
  if (readyCache && Date.now() - readyCache.at < 5 * 60_000) return readyCache.ids;
  const ok = await Promise.all(PRESETS.map(async (p) => ((await mediaSaved("main", "presets", fileOf(p.id)).catch(() => false)) ? p.id : null)));
  readyCache = { at: Date.now(), ids: new Set(ok.filter((x): x is string => Boolean(x))) };
  return readyCache.ids;
}

/** Draws up to `max` missing pictures (one-time cost, about US$0.13 each). */
export async function ensurePresetImages(max = 4): Promise<number> {
  const ready = await readyPresets();
  const missing = PRESETS.filter((p) => !ready.has(p.id)).slice(0, max);
  if (!missing.length) return 0;
  const provider = findImage("nano-banana-pro");
  if (!provider?.configured()) return 0;
  let made = 0;
  for (const p of missing) {
    try {
      const { bytes, mime } = await provider.generate({ prompt: presetPrompt(p), aspect: "4:5", refs: [] });
      await saveMedia("main", "presets", bytes, mime, fileOf(p.id));
      ready.add(p.id);
      made++;
    } catch (e) {
      console.error("avatar de Creads", p.id, e instanceof Error ? e.message : e);
      break; // the provider is failing: try again next round
    }
  }
  return made;
}
