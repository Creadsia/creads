import { sinVoseo } from "./image-batch";
import { LANG, type Pagina, productoPrompt } from "./tanda";
import { TIPOS, type TipoAngulo } from "./tanda-tipos";

// «Generador de hooks» (owner's plan, block E «Herramientas gratis»): a public page, no sign-up. The visitor
// pastes a product link or describes the product and gets 3 selling angles (one line each on why it can work)
// and 10 hooks in total. Same page reading and the same angle families as «Primera tanda» (src/lib/tanda.ts);
// one call to the text AI, kept short so each use costs about US$0.02–0.04.

export const HOOKS_TOTAL = 10;
export const ANGULOS_N = 3;
/** Free uses per connection per day (bucket «hooksIp» in src/lib/rate.ts). */
export const USOS_DIA = 3;

export interface AnguloHooks { tipo: TipoAngulo; titulo: string; por_que: string; hooks: string[] }
export interface ResultadoHooks { producto: string; angulos: AnguloHooks[] }

export function hooksPrompt(o: { pagina?: Pagina; descripcion?: string; idioma: "es" | "en" }) {
  return `You are a senior direct-response strategist for paid social (Meta, TikTok). Read the product and pick the ${ANGULOS_N} STRONGEST selling angles for it, each of a different kind among:
dolor (the problem it removes), deseo (the outcome the buyer wants), mecanismo (why it works / what makes it different), prueba_social (what other buyers do; ONLY numbers or reviews that appear on the page, otherwise non-numeric), creencia (a wrong belief that blocks the purchase, and the truth), oferta (the deal, price, guarantee or shipping; only what the page says).

${productoPrompt(o)}

For each angle write hooks: the first line of an ad (on-screen text or the first words spoken), max 10 words each, scroll-stopping, concrete, varied in form (question, bold claim, "if you…", a situation, a number ONLY if it comes from the product). Exactly ${HOOKS_TOTAL} hooks in total: 4 for the first angle, 3 for the second, 3 for the third. Never two alike.

Rules: write everything for the buyer in ${LANG(o.idioma)}. No promises of income or medical results, nothing misleading, no invented testimonials, quotes, stars or customer counts, no real brands other than the advertiser's.

Return JSON only:
{"producto": "short product name",
 "angulos": [{"tipo": "dolor|deseo|mecanismo|prueba_social|creencia|oferta", "titulo": "the angle in 3-7 words", "por_que": "one sentence: why this angle can sell this product", "hooks": ["…", "…"]}, … ${ANGULOS_N} items]}`;
}

const limpio = (v: unknown, max: number, es: boolean) => {
  if (typeof v !== "string") return "";
  const t = v.replace(/\s+/g, " ").trim();
  return (es ? sinVoseo(t) : t).slice(0, max);
};
const tipo = (v: unknown): TipoAngulo => ((TIPOS as readonly string[]).includes(String(v)) ? (v as TipoAngulo) : "deseo");
const clave = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9ñ]+/g, "");

/** Cleans the model's answer: at most 3 angles and 10 hooks in total, no repeated hooks, no empty ones. */
export function leerHooks(out: unknown, idioma: "es" | "en" = "es"): ResultadoHooks | null {
  const str = (v: unknown, max: number) => limpio(v, max, idioma === "es");
  const o = (out && typeof out === "object" ? out : {}) as Record<string, unknown>;
  const vistos = new Set<string>();
  let quedan = HOOKS_TOTAL;
  const angulos: AnguloHooks[] = [];
  for (const a of (Array.isArray(o.angulos) ? o.angulos : []).slice(0, ANGULOS_N) as Record<string, unknown>[]) {
    const hooks: string[] = [];
    for (const h of Array.isArray(a?.hooks) ? a.hooks : []) {
      const t = str(h, 140).replace(/^["«“]+|["»”]+$/g, "").trim();
      const k = clave(t);
      if (!t || !k || vistos.has(k) || quedan <= 0) continue;
      vistos.add(k);
      hooks.push(t);
      quedan--;
    }
    const titulo = str(a?.titulo, 90);
    if (!titulo || !hooks.length) continue;
    angulos.push({ tipo: tipo(a?.tipo), titulo, por_que: str(a?.por_que, 240), hooks });
  }
  const total = angulos.reduce((n, a) => n + a.hooks.length, 0);
  if (angulos.length < 2 || total < 5) return null;
  return { producto: str(o.producto, 120), angulos };
}

/** What the visitor typed, checked before anything is spent. Returns an error message or the clean input. */
export function entradaHooks(b: unknown): { url: string; descripcion: string; idioma: "es" | "en" } | { error: string } {
  const o = (b && typeof b === "object" ? b : {}) as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim().slice(0, 600) : "";
  const descripcion = typeof o.descripcion === "string" ? o.descripcion.trim().slice(0, 2000) : "";
  const idioma = o.idioma === "en" ? "en" : "es";
  if (url && !/^https?:\/\/\S+\.\S+/i.test(url)) return { error: "Ese link no se ve bien. Cópialo completo desde el navegador (empieza con https://)." };
  if (!url && descripcion.length < 15) return { error: "Pega el link de tu producto o cuéntanos qué vendes (una o dos frases)." };
  return { url, descripcion, idioma };
}
