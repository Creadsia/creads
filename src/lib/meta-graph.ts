// Meta Graph / Marketing API for the owner's marketing studio (Panel → Marketing and the office agents).
// Server-only. One system-user token (META_ADS_TOKEN) from the owner's Business Manager runs the ad account
// and the Instagram/Facebook pages. Nothing here runs until the owner pastes the keys in Vercel.

export const GRAPH_VERSION = () => (process.env.META_GRAPH_VERSION || "v25.0").trim();
const env = (k: string) => (process.env[k] ?? "").trim();

export interface MetaConfig { token: string; account: string; page: string; ig: string; pixel: string }
/** The ad account setup, or null while it isn't connected (the studio then works in «modo ensayo»). */
export function metaAds(): MetaConfig | null {
  const token = env("META_ADS_TOKEN"), account = env("META_AD_ACCOUNT_ID"), page = env("META_PAGE_ID");
  if (!token || !account || !page) return null;
  return { token, account: account.startsWith("act_") ? account : `act_${account}`, page, ig: env("META_IG_USER_ID"), pixel: env("NEXT_PUBLIC_META_PIXEL_ID") || env("META_PIXEL_ID") };
}
export const metaToken = () => env("META_ADS_TOKEN");

export class MetaError extends Error {
  constructor(message: string, public code = 0) { super(message); }
}

/** Calls the Graph API. GET params go in the query; POST params as a form (as Meta expects). */
export async function graph<T = Record<string, unknown>>(path: string, o: { method?: "GET" | "POST" | "DELETE"; params?: Record<string, unknown>; token?: string; timeoutMs?: number } = {}): Promise<T> {
  const token = o.token ?? metaToken();
  if (!token) throw new MetaError("Falta conectar Meta (META_ADS_TOKEN en Vercel).");
  const method = o.method ?? "GET";
  const url = new URL(`https://graph.facebook.com/${GRAPH_VERSION()}/${path.replace(/^\//, "")}`);
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(o.params ?? {})) {
    if (v === undefined || v === null) continue;
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    if (method === "GET") url.searchParams.set(k, s); else body.set(k, s);
  }
  body.set("access_token", token);
  if (method === "GET") url.searchParams.set("access_token", token);
  let res: Response;
  try {
    res = await fetch(url, { method, ...(method === "GET" ? {} : { body }), signal: AbortSignal.timeout(o.timeoutMs ?? 30_000) });
  } catch {
    throw new MetaError("Meta no respondió a tiempo. Prueba de nuevo en un rato.");
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_user_msg?: string; error_user_title?: string } } & T;
  if (!res.ok || data.error) {
    const e = data.error ?? {};
    const msg = e.error_user_msg || e.message || `Meta respondió ${res.status}`;
    if (e.code === 190) throw new MetaError("Meta rechazó el token: revisa META_ADS_TOKEN (puede haber vencido).", 190);
    if (e.code === 10 || e.code === 200 || e.code === 294) throw new MetaError(`Al token le falta un permiso: ${msg}`, e.code);
    if (e.code === 17 || e.code === 4 || e.code === 32 || e.code === 613) throw new MetaError("Meta pidió esperar (demasiadas solicitudes). Prueba en unos minutos.", e.code);
    // never echo the token back
    throw new MetaError(msg.replace(/access_token=[^&\s]+/g, "access_token=…").slice(0, 300), e.code ?? 0);
  }
  return data as T;
}

/** Currencies Meta counts in whole units (no cents) in budgets. */
const NO_CENTS = new Set(["CLP", "COP", "CRC", "HUF", "ISK", "IDR", "JPY", "KRW", "PYG", "TWD", "VND"]);
/** A budget in US$ as Meta wants it for an account in `currency` (`usdRate` = units of that currency per US$). */
export function budgetUnits(usd: number, currency: string, usdRate: number) {
  const amount = usd * (currency === "USD" ? 1 : usdRate);
  return NO_CENTS.has(currency) ? Math.round(amount) : Math.round(amount * 100);
}
/** A Meta budget back to US$. */
export function unitsToUsd(units: number, currency: string, usdRate: number) {
  const amount = NO_CENTS.has(currency) ? units : units / 100;
  return currency === "USD" ? amount : amount / (usdRate || 1);
}
