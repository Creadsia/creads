import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { readPrivateJSON, updatePrivateJSON, writePrivateJSON } from "./supabase";

// «Primera tanda» (owner's plan, 25 Oct 2026, P0): the customer pastes the link of their product, Creads reads
// the page, proposes 6 selling angles, the customer picks and a first batch of 10 ad images is made, each one
// in 4:5 (feed) and 9:16 (stories/reels), ready to download as a ZIP by placement.

import type { Angulo, Pieza, Producto, Tanda } from "./tanda-tipos";
export * from "./tanda-tipos";

// ---------- reading the product page (safely: public addresses only) ----------

function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return m ? privateIp(m[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function safeUrl(raw: string): Promise<URL> {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { throw new Error("Ese link no se ve bien. Cópialo completo desde el navegador (empieza con https://)."); }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password || (u.port && !["80", "443"].includes(u.port))) throw new Error("Solo se pueden leer páginas web normales (https://…).");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error("Esa dirección no es pública.");
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length) throw new Error("No encontramos esa página. Revisa el link.");
  if (addrs.some((a) => privateIp(a.address))) throw new Error("Esa dirección no es pública.");
  return u;
}

/** GET a public page or image (max 3 redirects, 10 s, size capped). */
export async function fetchPublic(raw: string, maxBytes: number, accept: string): Promise<{ bytes: Uint8Array; type: string; url: string }> {
  let url = (await safeUrl(raw)).toString();
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, {
      redirect: "manual", signal: AbortSignal.timeout(10_000),
      headers: { accept, "user-agent": "Mozilla/5.0 (compatible; CreadsBot/1.0; +https://www.creadsia.com)", "accept-language": "es-CL,es;q=0.9,en;q=0.8" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = (await safeUrl(new URL(res.headers.get("location")!, url).toString())).toString();
      continue;
    }
    if (!res.ok) throw new Error(`La página respondió con un error (${res.status}). Prueba con otro link o describe tu producto.`);
    const reader = res.body?.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) { await reader.cancel().catch(() => {}); break; }
      parts.push(value);
    }
    const bytes = new Uint8Array(Math.min(size, maxBytes));
    let o = 0;
    for (const p of parts) { const take = Math.min(p.length, bytes.length - o); bytes.set(p.subarray(0, take), o); o += take; if (o >= bytes.length) break; }
    return { bytes, type: res.headers.get("content-type") ?? "", url };
  }
  throw new Error("La página redirige demasiadas veces.");
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const meta = (html: string, key: string) => {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag ? decode(tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "").trim() : "";
};

export interface Pagina { url: string; titulo: string; descripcion: string; precio: string; imagenes: string[]; texto: string }

/** What a product page says: title, description, price and photos (meta tags and JSON-LD), plus its text. */
export async function leerPagina(raw: string): Promise<Pagina> {
  const { bytes, type, url } = await fetchPublic(raw, 1_500_000, "text/html,application/xhtml+xml");
  if (type && !/html|xml|text/i.test(type)) throw new Error("Ese link no es una página web (parece un archivo).");
  const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  let titulo = meta(html, "og:title") || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? "").trim();
  let descripcion = meta(html, "og:description") || meta(html, "description");
  let precio = meta(html, "product:price:amount") ? `${meta(html, "product:price:amount")} ${meta(html, "product:price:currency")}`.trim() : "";
  const imagenes = [meta(html, "og:image"), meta(html, "og:image:secure_url")].filter(Boolean);
  // JSON-LD «Product» (Shopify, WooCommerce, Tiendanube, Jumpseller…): the most reliable data
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1].trim());
      const all = (Array.isArray(data) ? data : data["@graph"] ?? [data]) as Record<string, unknown>[];
      const p = all.find((x) => String(x?.["@type"] ?? "").includes("Product"));
      if (!p) continue;
      if (typeof p.name === "string") titulo = p.name;
      if (typeof p.description === "string" && p.description.length > descripcion.length) descripcion = p.description;
      const img = p.image;
      for (const i of (Array.isArray(img) ? img : [img])) { const s = typeof i === "string" ? i : (i as { url?: string })?.url; if (s) imagenes.push(s); }
      const off = (Array.isArray(p.offers) ? p.offers[0] : p.offers) as Record<string, unknown> | undefined;
      if (off?.price && !precio) precio = `${off.price} ${off.priceCurrency ?? ""}`.trim();
    } catch { /* not valid JSON */ }
  }
  const texto = decode(html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim().slice(0, 7000);
  const abs = [...new Set(imagenes.map((i) => { try { return new URL(i, url).toString(); } catch { return ""; } }).filter((i) => /^https?:/.test(i)))].slice(0, 4);
  return { url, titulo: titulo.slice(0, 200), descripcion: descripcion.replace(/\s+/g, " ").slice(0, 1500), precio: precio.slice(0, 40), imagenes: abs, texto };
}

// ---------- prompts ----------

const LANG = (l: "es" | "en") => (l === "en" ? "English (United States)" : "Spanish (neutral Latin American, «tú», never «vos»)");

export function angulosPrompt(o: { pagina?: Pagina; descripcion?: string; brief: string; idioma: "es" | "en" }) {
  const src = o.pagina
    ? `PRODUCT PAGE (${o.pagina.url})\nTitle: ${o.pagina.titulo}\nDescription: ${o.pagina.descripcion}\nPrice: ${o.pagina.precio || "not shown"}\nPage text: """${o.pagina.texto}"""`
    : `THE ADVERTISER DESCRIBES THEIR PRODUCT: """${o.descripcion}"""`;
  return `You are a senior direct-response strategist for paid social (Meta, TikTok). Read the product and propose ONE selling angle of each of these 6 kinds, in this order:
1. dolor: the problem or frustration it removes
2. deseo: the outcome or feeling the buyer wants
3. mecanismo: why it works / what makes it different (the "how")
4. prueba_social: what other buyers do or say. ONLY use numbers, reviews or ratings that appear on the page; if there are none, use a non-numeric angle (e.g. "the kind of person who already uses it", a common situation). NEVER invent testimonials, quotes, stars or customer counts.
5. creencia: a wrong belief the buyer has that blocks the purchase, and the truth
6. oferta: the deal, price, guarantee, shipping or bonus. Only what the page says; if nothing, the plain value for money.

${src}

${o.brief ? `BRAND KIT\n${o.brief}\n` : ""}
Rules: write everything for the buyer in ${LANG(o.idioma)}. No promises of income or medical results, nothing misleading, no real brands other than the advertiser's.

Return JSON only:
{"producto": {"nombre": "short product name", "descripcion": "what it is, 1-2 sentences", "precio": "as shown or empty", "publico": "who buys it, 1 sentence", "beneficios": ["3 to 5 short benefits"], "objeciones": ["2 or 3 doubts a buyer has"]},
 "angulos": [{"tipo": "dolor", "titulo": "the angle in 3-7 words", "gancho": "the hook as it would appear on the ad, max 8 words", "por_que": "one sentence: why this angle can sell"}, … 6 items]}`;
}

const ESTILOS = [
  "product hero shot: the product big and sharp, clean or lifestyle background in the brand colours, the hook as a bold headline",
  "UGC selfie: a real-looking customer holding or using the product, casual smartphone photo, the hook as a social caption sticker",
  "person holding a handwritten cardboard sign with the hook, the product visible",
  "before / after split in one image, same framing, the difference obvious, short labels",
  "bold typographic ad: the hook in huge type on a brand-colour background, the product small in a corner",
  "native social post: candid everyday photo where the product appears naturally, the hook as a short text overlay",
  "problem scene: a person living the problem, frustrated, the hook as a headline, the product as the way out",
  "offer card: the product with a clear price/deal badge (only real deals), the hook as a headline",
];

export function tandaPrompt(o: { producto: Producto; angulos: Angulo[]; n: number; brief: string; idioma: "es" | "en"; conFoto: boolean }) {
  return `You write image-generation prompts for a batch of ${o.n} paid social ads (Meta feed and stories) to TEST against each other.

PRODUCT: ${o.producto.nombre}. ${o.producto.descripcion}${o.producto.precio ? ` Price: ${o.producto.precio}.` : ""}
Buyer: ${o.producto.publico}
Benefits: ${o.producto.beneficios.join("; ")}
${o.brief ? `BRAND KIT\n${o.brief}\n` : ""}
ANGLES TO USE (spread the ${o.n} ads across them as evenly as possible, in this order):
${o.angulos.map((a, i) => `${i + 1}. [${a.tipo}] ${a.titulo} — hook: "${a.gancho}"`).join("\n")}

VISUAL STYLES (use a different one for consecutive ads, so the batch looks varied):
${ESTILOS.map((s, i) => `${String.fromCharCode(97 + i)}) ${s}`).join("\n")}

Rules:
- Each ad = one angle + one style + one headline. Headlines differ: never two the same.
- The headline goes IN the image, in double quotes inside the prompt, max 7 words, spelled exactly, in ${LANG(o.idioma)}.
- Write each prompt in English, detailed and photorealistic unless the style is typographic.
- ${o.conFoto ? "A photo of the real product is attached to every image: say «the product from the reference photo» and keep it exactly as it is (shape, label, colours)." : "Describe the product precisely so it looks the same in every ad."}
- Keep faces, product and text inside the central safe area, away from the top and bottom 15% and the sides 8% (the image is shown as 4:5 and as 9:16).
- Only original people and invented settings: no celebrities, no other brands or logos. No fake reviews, stars or customer counts. No promises of income or medical results.

Return JSON only: {"piezas": [{"tipo": "dolor|deseo|mecanismo|prueba_social|creencia|oferta", "titular": "the headline", "estilo": "a-h", "prompt": "..."}]} with exactly ${o.n} items.`;
}

// ---------- storage ----------

const file = (ws: string, id: string) => `tandas/${ws}/${id}.json`;
const indexFile = (ws: string) => `tandas/${ws}/index.json`;
export const tandaId = () => `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
export const validId = (id: unknown): id is string => typeof id === "string" && /^t_[a-z0-9]{8,20}$/.test(id);

export async function guardarTanda(ws: string, t: Tanda) {
  await writePrivateJSON(file(ws, t.id), t);
  await updatePrivateJSON<string[]>(indexFile(ws), (cur) => [t.id, ...(cur ?? []).filter((x) => x !== t.id)].slice(0, 100));
}
export const cargarTanda = (ws: string, id: string) => (validId(id) ? readPrivateJSON<Tanda>(file(ws, id)).catch(() => null) : Promise.resolve(null));
export async function listarTandas(ws: string) {
  const ids = ((await readPrivateJSON<string[]>(indexFile(ws)).catch(() => null)) ?? []).slice(0, 20);
  return (await Promise.all(ids.map((id) => cargarTanda(ws, id)))).filter((t): t is Tanda => Boolean(t));
}
/** Changes one piece of a batch (the browser reports each finished image). */
export async function actualizarPieza(ws: string, id: string, n: number, patch: Partial<Pieza>) {
  if (!validId(id)) return null;
  return updatePrivateJSON<Tanda>(file(ws, id), (t) => {
    if (!t) return undefined;
    return { ...t, updatedAt: new Date().toISOString(), piezas: t.piezas.map((p) => (p.n === n ? { ...p, ...patch } : p)) };
  });
}

// ---------- ZIP names ----------

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "anuncio";
/** «feed-4x5/03-dolor-tu-espalda-no-aguanta-mas.jpg» */
export const zipName = (p: Pieza, f: "4x5" | "9x16", ext: string) =>
  `${f === "4x5" ? "feed-4x5" : "stories-reels-9x16"}/${String(p.n).padStart(2, "0")}-${p.tipo.replace("_", "-")}-${slug(p.titular)}-${f}.${ext}`;
