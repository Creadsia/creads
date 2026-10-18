import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { readPrivateJSON, writePrivateJSON } from "./supabase";

// The marketing area's own connections with Meta (pixel, Conversions API, ad account, page, Instagram),
// saved from Panel → Marketing → Conexiones by the owner or a partner, so marketing doesn't need Vercel.
// Server only. Tokens are stored encrypted (AES-256-GCM) in the private bucket and never sent back to the
// browser: the panel only sees whether each one is set and its last 4 characters.
// A value saved here wins over the Vercel variable of the same thing; with nothing saved, Vercel's is used.

const FILE = "marketing/conexiones.json";

export interface MetaConn {
  pixelId: string;
  adAccountId: string;
  pageId: string;
  igUserId: string;
  testEventCode: string;
  capiToken: string; // secret
  adsToken: string; // secret
  appSecret: string; // secret: signs the comment webhooks
  webhookToken: string; // the word Meta sends to check the webhook URL (typed in Meta's app, so shown)
}
export const SECRET_KEYS = ["capiToken", "adsToken", "appSecret"] as const;
export const PLAIN_KEYS = ["pixelId", "adAccountId", "pageId", "igUserId", "testEventCode", "webhookToken"] as const;
type Key = keyof MetaConn;

const ENV: Record<Key, string[]> = {
  pixelId: ["NEXT_PUBLIC_META_PIXEL_ID", "META_PIXEL_ID"],
  adAccountId: ["META_AD_ACCOUNT_ID"],
  pageId: ["META_PAGE_ID"],
  igUserId: ["META_IG_USER_ID"],
  testEventCode: ["META_TEST_EVENT_CODE"],
  capiToken: ["META_CAPI_TOKEN"],
  adsToken: ["META_ADS_TOKEN"],
  appSecret: ["META_APP_SECRET"],
  webhookToken: ["META_WEBHOOK_VERIFY_TOKEN"],
};
const fromEnv = (k: Key) => ENV[k].map((e) => (process.env[e] ?? "").trim()).find(Boolean) ?? "";

/** The pixel that's been on the site since the start (used when nothing else is set). */
export const DEFAULT_PIXEL = "2078637222831496";

// ---------------------------------------------------------------- encryption

const key = () => createHash("sha256").update(`creads:meta-conexiones:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest();
function seal(text: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(text, "utf8"), c.final()]);
  return `v1.${iv.toString("base64url")}.${c.getAuthTag().toString("base64url")}.${body.toString("base64url")}`;
}
function open(sealed: string): string {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !body) return "";
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
  } catch { return ""; }
}

// ---------------------------------------------------------------- read / write

interface Stored { plain: Partial<Record<Key, string>>; sealed: Partial<Record<Key, string>>; updatedAt?: string; by?: string }
let cache: { at: number; v: Stored } | null = null;
async function stored(): Promise<Stored> {
  if (cache && Date.now() - cache.at < 60_000) return cache.v;
  const v = (await readPrivateJSON<Stored>(FILE).catch(() => null)) ?? { plain: {}, sealed: {} };
  cache = { at: Date.now(), v: { plain: v.plain ?? {}, sealed: v.sealed ?? {}, updatedAt: v.updatedAt, by: v.by } };
  return cache.v;
}

/** Every connection value in effect (panel first, then Vercel). Server only: includes the tokens. */
export async function metaConn(): Promise<MetaConn> {
  const s = await stored().catch(() => ({ plain: {}, sealed: {} }) as Stored);
  const get = (k: Key) => ((SECRET_KEYS as readonly string[]).includes(k) ? (s.sealed[k] ? open(s.sealed[k]!) : "") : s.plain[k] ?? "") || fromEnv(k);
  return { pixelId: get("pixelId") || DEFAULT_PIXEL, adAccountId: get("adAccountId"), pageId: get("pageId"), igUserId: get("igUserId"), testEventCode: get("testEventCode"), capiToken: get("capiToken"), adsToken: get("adsToken"), appSecret: get("appSecret"), webhookToken: get("webhookToken") };
}

const RULES: Record<Key, [RegExp, string]> = {
  pixelId: [/^\d{8,20}$/, "El ID del píxel son solo números (unos 15 o 16)."],
  adAccountId: [/^(act_)?\d{5,25}$/, "El ID de la cuenta publicitaria son solo números (puede empezar con act_)."],
  pageId: [/^\d{5,25}$/, "El ID de la página son solo números."],
  igUserId: [/^\d{5,30}$/, "El ID de Instagram son solo números."],
  testEventCode: [/^[A-Z0-9]{3,20}$/i, "El código de prueba es corto, letras y números (por ejemplo TEST12345)."],
  capiToken: [/^[A-Za-z0-9_-]{40,600}$/, "Ese token no parece completo: cópialo entero, sin espacios."],
  adsToken: [/^[A-Za-z0-9_-]{40,600}$/, "Ese token no parece completo: cópialo entero, sin espacios."],
  appSecret: [/^[a-f0-9]{32}$/i, "La clave secreta de la app son 32 letras y números (Meta for Developers → tu app → Configuración → Básica → Clave secreta)."],
  webhookToken: [/^[A-Za-z0-9_-]{16,80}$/, "La clave del webhook debe tener entre 16 y 80 letras o números."],
};

/** Saves what the panel sent. Empty string = remove (falls back to Vercel). Returns an error text or null. */
export async function saveMetaConn(patch: Partial<Record<Key, unknown>>, by: string): Promise<string | null> {
  const clean: Partial<Record<Key, string>> = {};
  for (const k of Object.keys(RULES) as Key[]) {
    if (patch[k] === undefined || patch[k] === null) continue;
    const v = String(patch[k]).replace(/\s+/g, "").trim();
    if (v && !RULES[k][0].test(v)) return RULES[k][1];
    clean[k] = k === "adAccountId" ? v.replace(/^act_/, "") : v;
  }
  const cur = (await readPrivateJSON<Stored>(FILE)) ?? { plain: {}, sealed: {} };
  const next: Stored = { plain: { ...(cur.plain ?? {}) }, sealed: { ...(cur.sealed ?? {}) }, updatedAt: new Date().toISOString(), by: by.slice(0, 80) };
  for (const [k, v] of Object.entries(clean) as [Key, string][]) {
    const secret = (SECRET_KEYS as readonly string[]).includes(k);
    const box = secret ? next.sealed : next.plain;
    if (v) box[k] = secret ? seal(v) : v; else delete box[k];
  }
  await writePrivateJSON(FILE, next);
  cache = null;
  return null;
}

/** What the panel may see: each value's state, never a token. */
export async function metaConnView() {
  const s = await stored().catch(() => ({ plain: {}, sealed: {} }) as Stored);
  const c = await metaConn();
  const tail = (v: string) => (v ? `…${v.slice(-4)}` : "");
  const src = (k: Key) => ((SECRET_KEYS as readonly string[]).includes(k) ? (s.sealed[k] ? "panel" : fromEnv(k) ? "vercel" : null) : s.plain[k] ? "panel" : fromEnv(k) ? "vercel" : null);
  return {
    pixelId: { value: c.pixelId, from: src("pixelId") ?? "inicial" },
    adAccountId: { value: c.adAccountId, from: src("adAccountId") },
    pageId: { value: c.pageId, from: src("pageId") },
    igUserId: { value: c.igUserId, from: src("igUserId") },
    testEventCode: { value: c.testEventCode, from: src("testEventCode") },
    capiToken: { value: tail(c.capiToken), from: src("capiToken") },
    adsToken: { value: tail(c.adsToken), from: src("adsToken") },
    appSecret: { value: tail(c.appSecret), from: src("appSecret") },
    webhookToken: { value: c.webhookToken, from: src("webhookToken") },
    updatedAt: s.updatedAt ?? null, by: s.by ?? null,
  };
}
