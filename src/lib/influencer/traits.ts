// The character creator for «Influencer IA» (like Higgsfield's AI Influencer): pick each trait from
// options, by character type, and get a structured prompt for a character sheet (front, side, back,
// face close-up, full body) made with Nano Banana Pro. Browser-safe: the page and the tests use it.

export type Tier = "normal" | "raro" | "total" | "animal";
export const TIERS: { id: Tier; label: string; hint: string }[] = [
  { id: "normal", label: "Normal", hint: "Persona realista." },
  { id: "raro", label: "Raro", hint: "Rasgos exagerados, el estilo «brainrot» que se viraliza." },
  { id: "total", label: "Total", hint: "Sin límites: mandíbula gigante, cavernícola, centauro…" },
  { id: "animal", label: "Animales", hint: "Gatos, perros, capibaras, ranas… con cuerpo humanoide y ropa." },
];

interface Opt { id: string; es: string; en: string; tiers?: Tier[] }
export interface Field { key: string; label: string; max: number; opts: Opt[]; tiers?: Tier[] }

const o = (id: string, es: string, en: string, tiers?: Tier[]): Opt => ({ id, es, en, ...(tiers ? { tiers } : {}) });
const WEIRD: Tier[] = ["raro", "total"];
const PEOPLE: Tier[] = ["normal", "raro", "total"];

export const FIELDS: Field[] = [
  { key: "especie", label: "Animal", max: 1, tiers: ["animal"], opts: [
    o("gato", "Gato", "cat"), o("perro", "Perro", "dog"), o("capibara", "Capibara", "capybara"), o("rana", "Rana", "frog"),
    o("insecto", "Insecto", "insect"), o("ave", "Ave", "bird"), o("zorro", "Zorro", "fox"), o("oso", "Oso", "bear"),
  ] },
  { key: "genero", label: "Género", max: 1, opts: [o("mujer", "Mujer", "woman"), o("hombre", "Hombre", "man"), o("nobinario", "No binario", "androgynous non-binary person")] },
  { key: "cuerpo", label: "Cuerpo", max: 1, opts: [
    o("delgado", "Delgado", "slim build"), o("atletico", "Atlético", "athletic build"), o("musculoso", "Musculoso", "muscular build"),
    o("curvilineo", "Curvilíneo", "curvy build"), o("grande", "Grande", "large heavy build"), o("ultra", "Ultra musculoso", "absurdly hyper-muscular bodybuilder build"),
    o("centauro", "Centauro", "centaur body: human torso on a horse body", ["total"]),
  ] },
  { key: "peinado", label: "Peinado", max: 1, tiers: [...PEOPLE, "animal"], opts: [
    o("calvo", "Calvo", "bald"), o("rapado", "Rapado", "buzz cut"), o("taza", "Taza", "bowl cut"), o("mullet", "Mullet", "mullet"),
    o("trenzas", "Trenzas", "braids"), o("coletas", "Coletas", "pigtails"), o("afro", "Afro", "afro"), o("mohicano", "Mohicano", "mohawk"),
    o("largo", "Largo", "long hair"), o("corto", "Corto", "short hair"),
    o("bob", "Bob", "bob cut", WEIRD), o("ondas", "Ondas con volumen", "big voluminous waves", WEIRD), o("colmena", "Colmena", "towering beehive hairdo", WEIRD),
    o("permanente", "Permanente", "tight perm", WEIRD), o("cuernos", "Cuernos de pelo", "hair shaped into two horns", WEIRD),
    o("helado", "Remolino de helado", "hair swirled like soft-serve ice cream", WEIRD), o("esfera", "Esfera de rulos", "a perfect sphere of curls", WEIRD),
    o("raton", "Orejas de ratón", "hair buns shaped like mouse ears", WEIRD), o("alas", "Alas de pelo", "hair shaped like wings", WEIRD),
    o("puas", "Púas de erizo", "hedgehog spikes hair", WEIRD), o("escalones", "Escalones", "stair-stepped layered hair", WEIRD),
    o("hongo", "Hongo", "mushroom-cap hair", WEIRD), o("sacacorchos", "Sacacorchos", "corkscrew ringlets", WEIRD),
  ] },
  { key: "colorPelo", label: "Color de pelo", max: 1, tiers: [...PEOPLE, "animal"], opts: [
    o("negro", "Negro", "black"), o("castanoOscuro", "Castaño oscuro", "dark brown"), o("castano", "Castaño", "brown"), o("colorin", "Colorín", "ginger"),
    o("rojo", "Rojo", "bright red"), o("rubio", "Rubio", "blonde"), o("platino", "Platino", "platinum blonde"), o("gris", "Gris", "grey"),
    o("blanco", "Blanco", "white"), o("rosado", "Rosado pastel", "pastel pink"), o("lila", "Lila", "lilac"), o("azul", "Azul", "blue"), o("verde", "Verde", "green"),
  ] },
  { key: "ropa", label: "Estilo de ropa", max: 1, opts: [
    o("casual", "Casual", "casual everyday outfit"), o("deportivo", "Deportivo", "sporty athleisure outfit"), o("street", "Streetstyle", "streetwear outfit"),
    o("y2k", "Y2K", "Y2K style outfit"), o("retro", "Retro", "retro vintage outfit"), o("gotico", "Gótico", "gothic outfit"),
    o("teatral", "Teatral", "flamboyant theatrical outfit"), o("terno", "Terno", "tailored suit"),
  ] },
  { key: "etnia", label: "Etnia", max: 1, tiers: PEOPLE, opts: [
    o("africana", "Africana", "African"), o("asiatica", "Asiática", "East Asian"), o("europea", "Europea", "European"),
    o("india", "India", "South Asian"), o("medio", "Medio Oriente", "Middle Eastern"), o("latina", "Latina / mixta", "Latin American mixed heritage"),
  ] },
  { key: "edad", label: "Edad", max: 1, opts: [o("adulto", "Adulto", "young adult (around 25)"), o("maduro", "Maduro", "middle-aged (around 45)"), o("mayor", "Mayor", "elderly (around 70)")] },
  { key: "piel", label: "Tono de piel", max: 1, tiers: PEOPLE, opts: [
    o("porcelana", "Porcelana", "porcelain skin"), o("clara", "Clara", "fair skin"), o("media", "Media", "light-medium skin"), o("oliva", "Oliva", "olive skin"),
    o("canela", "Canela", "tan skin"), o("morena", "Morena", "brown skin"), o("oscura", "Oscura", "dark brown skin"), o("ebano", "Ébano", "deep ebony skin"),
  ] },
  { key: "altura", label: "Altura", max: 1, opts: [o("promedio", "Promedio", "average height"), o("alto", "Alto", "tall"), o("muyAlto", "Muy alto", "very tall")] },
  { key: "proporciones", label: "Proporciones", max: 2, opts: [
    o("extremidades", "Extremidades largas", "long limbs"), o("piernasCortas", "Piernas cortas", "short legs"), o("hombros", "Hombros anchos", "broad shoulders"),
    o("cintura", "Cintura mínima", "tiny waist"), o("huevo", "Cuerpo de huevo", "egg-shaped body", WEIRD),
  ] },
  { key: "cabeza", label: "Forma de la cabeza", max: 1, opts: [
    o("estandar", "Estándar", "standard head shape"), o("larga", "Larga", "long face"), o("redonda", "Redonda", "round face"), o("cuadrada", "Cuadrada", "square face"),
    o("corazon", "Corazón", "heart-shaped face"), o("diminuta", "Diminuta", "tiny head", WEIRD), o("frente", "Frente alta", "very high forehead", WEIRD),
    o("cavernicola", "Cavernícola", "caveman heavy-browed head", ["total"]), o("gigachad", "Gigachad", "chiseled gigachad jawline", ["total"]), o("mega", "Mandíbula mega", "gigantic exaggerated jaw", ["total"]),
  ] },
  { key: "cuello", label: "Cuello", max: 1, opts: [o("estandar", "Estándar", "standard neck"), o("corto", "Corto", "short neck"), o("largo", "Largo", "very long neck", WEIRD), o("columna", "Columna", "thick column neck", WEIRD)] },
  { key: "formaOjos", label: "Forma de los ojos", max: 1, opts: [o("almendra", "Almendrados", "almond eyes"), o("redondos", "Redondos", "round eyes"), o("rasgados", "Rasgados", "narrow eyes"), o("grandes", "Grandes", "big eyes")] },
  { key: "colorOjos", label: "Color de ojos", max: 1, opts: [o("cafe", "Café", "brown eyes"), o("miel", "Miel", "hazel eyes"), o("verde", "Verde", "green eyes"), o("azul", "Azul", "blue eyes"), o("gris", "Gris", "grey eyes"), o("negro", "Negro", "dark eyes")] },
  { key: "cara", label: "Rasgos de la cara", max: 4, tiers: PEOPLE, opts: [
    o("pecas", "Pecas", "freckles"), o("hoyuelos", "Hoyuelos", "dimples"), o("ojeras", "Ojeras", "under-eye bags"), o("pomulos", "Pómulos altos", "high cheekbones"),
    o("labios", "Labios gruesos", "full lips"), o("cejas", "Cejas gruesas", "thick eyebrows"), o("lunar", "Lunar", "a beauty mark"), o("narizChica", "Nariz chica", "small nose"),
    o("papa", "Nariz de papa", "big potato nose", WEIRD), o("monoceja", "Monoceja", "unibrow", WEIRD), o("jarro", "Orejas de jarro", "big sticking-out ears", WEIRD),
    o("separados", "Dientes separados", "gap teeth", WEIRD), o("menton", "Mentón débil", "weak chin", WEIRD), o("frenteGrande", "Frente grande", "huge forehead", WEIRD),
  ] },
  { key: "vello", label: "Vello facial", max: 1, tiers: PEOPLE, opts: [
    o("limpio", "Limpio", "clean-shaven"), o("dias", "Barba de días", "stubble"), o("completa", "Barba completa", "full beard"), o("candado", "Candado", "goatee"),
    o("bigote", "Bigote", "moustache"), o("fino", "Bigote fino", "thin pencil moustache"), o("escoba", "Escoba", "huge broom moustache", WEIRD), o("trenzado", "Trenzado", "braided beard", WEIRD),
  ] },
  { key: "distintivos", label: "Rasgos distintivos", max: 2, opts: [
    o("heterocromia", "Ojos de distinto color", "heterochromia (two different eye colors)"), o("tatuaje", "Tatuaje en la cara", "a small face tattoo"), o("piercing", "Piercing", "facial piercings"),
    o("frenillos", "Frenillos", "braces"), o("oro", "Diente de oro", "a gold tooth"), o("cicatriz", "Cicatriz en la ceja", "a scar through one eyebrow"),
    o("elfo", "Orejas de elfo", "pointed elf ears"), o("pestanas", "Pestañas grandes", "huge eyelashes"), o("gemas", "Gemas en la cara", "small gems on the face"),
  ] },
  { key: "accesorios", label: "Accesorios", max: 3, opts: [o("lentes", "Lentes", "glasses"), o("audifonos", "Audífonos", "headphones"), o("joyas", "Joyas", "jewelry"), o("sombrero", "Sombrero", "a hat"), o("bolso", "Bolso", "a bag")] },
];

export interface Traits {
  tier: Tier;
  picks: Record<string, string[]>;
  /** Body/fur/skin color for Raro, Total and Animales (hex). */
  color?: string;
  /** Free description (optional, up to 4.000 characters). */
  extra?: string;
}

/** The fields shown for a character type, each with only the options that type allows. */
export function fieldsFor(tier: Tier): Field[] {
  return FIELDS.filter((f) => !f.tiers || f.tiers.includes(tier))
    .map((f) => ({ ...f, opts: f.opts.filter((x) => !x.tiers || x.tiers.includes(tier)) }))
    .filter((f) => f.opts.length > 0);
}

/** Keeps only valid picks (known option, allowed for the type, within the field's maximum). */
export function cleanTraits(t: Traits): Traits {
  const tier: Tier = TIERS.some((x) => x.id === t.tier) ? t.tier : "normal";
  const picks: Record<string, string[]> = {};
  for (const f of fieldsFor(tier)) {
    const ok = (t.picks?.[f.key] ?? []).filter((id, i, a) => a.indexOf(id) === i && f.opts.some((x) => x.id === id)).slice(0, f.max);
    if (ok.length) picks[f.key] = ok;
  }
  const color = tier !== "normal" && typeof t.color === "string" && /^#[0-9a-f]{6}$/i.test(t.color) ? t.color.toUpperCase() : undefined;
  const extra = typeof t.extra === "string" ? t.extra.trim().slice(0, 4000) : "";
  return { tier, picks, ...(color ? { color } : {}), ...(extra ? { extra } : {}) };
}

/** «Sorpréndeme»: fills every field that wasn't chosen with a random allowed option. */
export function surprise(t: Traits, rand: () => number = Math.random): Traits {
  const picks = { ...t.picks };
  for (const f of fieldsFor(t.tier)) {
    if (picks[f.key]?.length) continue;
    if (f.max > 1 && rand() < 0.4) continue; // multi-pick extras stay optional sometimes
    picks[f.key] = [f.opts[Math.floor(rand() * f.opts.length)].id];
  }
  return cleanTraits({ ...t, picks });
}

const en = (f: Field, ids: string[] | undefined) => (ids ?? []).map((id) => f.opts.find((x) => x.id === id)?.en).filter(Boolean).join(", ");

/** The character in words (English, for the image model). */
export function describe(t0: Traits): string {
  const t = cleanTraits(t0);
  const get = (key: string) => { const f = FIELDS.find((x) => x.key === key)!; return en(fieldsFor(t.tier).find((x) => x.key === key) ?? f, t.picks[key]); };
  const who = t.tier === "animal"
    ? `an anthropomorphic ${get("especie") || "animal"} with a humanoid body standing upright, wearing clothes`
    : [get("edad"), get("etnia"), get("genero") || "person"].filter(Boolean).join(" ");
  const parts = [
    who,
    get("cuerpo"), get("altura"), get("proporciones") && `proportions: ${get("proporciones")}`,
    get("cabeza"), get("cuello"),
    get("peinado") && `hair: ${[get("colorPelo"), get("peinado")].filter(Boolean).join(" ")}`,
    get("piel"), [get("formaOjos"), get("colorOjos")].filter(Boolean).join(", "),
    get("cara") && `face: ${get("cara")}`, get("vello"), get("distintivos") && `distinctive: ${get("distintivos")}`,
    get("ropa") && `wearing a ${get("ropa")}`, get("accesorios") && `accessories: ${get("accesorios")}`,
    t.color && `${t.tier === "animal" ? "fur/skin" : "body"} color ${t.color}`,
  ].filter(Boolean);
  return parts.join("; ");
}

const STYLE: Record<Tier, string> = {
  normal: "Photorealistic, natural and believable, real skin texture.",
  raro: "Photorealistic but with deliberately exaggerated, funny features (viral «brainrot» style), still believable lighting and texture.",
  total: "Photorealistic rendering of an absurd, over-the-top character with no limits on proportions, still real lighting and texture.",
  animal: "Photorealistic anthropomorphic animal, real fur/skin texture, expressive face, humanoid posture.",
};

/**
 * The prompt for the character sheet. With an identity photo it is a guide, not an exact copy: the chosen
 * options win. Style references only set the look. Never a real or famous person.
 */
export function sheetPrompt(t0: Traits): string {
  const t = cleanTraits(t0);
  return [
    "Character reference sheet of ONE original, fictional character (not a real or famous person), on a plain light grey background.",
    "Layout, same character in every view, consistent face, body, colors and clothes: front view full body, side profile full body, back view full body, and a large close-up portrait of the face.",
    `The character: ${describe(t)}.`,
    t.extra ? `Extra details: ${t.extra}` : "",
    "If reference images are attached: the first one is only a loose guide for the face (where it disagrees with this description, follow the description); any others only set the overall look (colors, styling, mood).",
    STYLE[t.tier],
    "Neutral pose, even studio lighting, sharp focus. No text, no labels, no captions, no watermark, no logos.",
  ].filter(Boolean).join("\n");
}

/** Saved characters per plan (Starter 1, Plus 3, Studio unlimited; the owner's team has no limit). */
export function characterLimit(plan: string | null, unlimited = false): number {
  if (unlimited) return Infinity;
  const p = (plan ?? "").toLowerCase(); // stored as the plan's name («Studio», «Plus»…) or its id
  if (p.includes("studio")) return Infinity;
  if (p.includes("plus")) return 3;
  return 1;
}
