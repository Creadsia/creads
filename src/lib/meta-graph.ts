// Meta Graph / Marketing API for the owner's marketing studio (Panel → Marketing and the office agents).
// Server-only. One system-user token (META_ADS_TOKEN) from the owner's Business Manager runs the ad account
// and the Instagram/Facebook pages. Nothing here runs until the owner pastes the keys in Vercel.

export const GRAPH_VERSION = () => (process.env.META_GRAPH_VERSION || "v25.0").trim();
import { metaConn } from "./meta-conexiones";

export interface MetaConfig { token: string; account: string; page: string; ig: string; pixel: string }
/** The ad account setup (Panel → Marketing → Conexiones, or Vercel), or null while it isn't connected
 * (the studio then works in «modo ensayo»). */
export async function metaAds(): Promise<MetaConfig | null> {
  const c = await metaConn();
  if (!c.adsToken || !c.adAccountId || !c.pageId) return null;
  return { token: c.adsToken, account: c.adAccountId.startsWith("act_") ? c.adAccountId : `act_${c.adAccountId}`, page: c.pageId, ig: c.igUserId, pixel: c.pixelId };
}
export const metaToken = async () => (await metaConn()).adsToken;

export class MetaError extends Error {
  constructor(message: string, public code = 0) { super(message); }
}

/** Calls the Graph API. GET params go in the query; POST params as a form (as Meta expects). */
export async function graph<T = Record<string, unknown>>(path: string, o: { method?: "GET" | "POST" | "DELETE"; params?: Record<string, unknown>; token?: string; timeoutMs?: number } = {}): Promise<T> {
  const token = o.token ?? (await metaToken());
  if (!token) throw new MetaError("Falta conectar Meta: pega el token en Panel → Marketing → Conexiones.");
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

/** Checks each connection with Meta and says, in plain words, what works and what doesn't. */
export async function probarMeta(): Promise<{ item: string; ok: boolean; detalle: string }[]> {
  const c = await metaConn();
  const out: { item: string; ok: boolean; detalle: string }[] = [];
  const msg = (e: unknown) => (e instanceof Error ? e.message : "No respondió.").slice(0, 200);
  if (!c.adsToken) out.push({ item: "Token del usuario del sistema", ok: false, detalle: "Falta pegarlo." });
  else {
    try { const me = await graph<{ name?: string }>("me", { params: { fields: "name" }, token: c.adsToken }); out.push({ item: "Token del usuario del sistema", ok: true, detalle: `Funciona (${me.name ?? "usuario del sistema"}).` }); }
    catch (e) { out.push({ item: "Token del usuario del sistema", ok: false, detalle: msg(e) }); }
    if (c.adAccountId) {
      try {
        const a = await graph<{ name?: string; currency?: string; account_status?: number }>(`act_${c.adAccountId.replace(/^act_/, "")}`, { params: { fields: "name,currency,account_status" }, token: c.adsToken });
        out.push({ item: "Cuenta publicitaria", ok: a.account_status === 1, detalle: `${a.name ?? "Cuenta"} · ${a.currency ?? ""}${a.account_status === 1 ? " · activa" : " · Meta dice que no está activa: revisa el método de pago o restricciones"}` });
      } catch (e) { out.push({ item: "Cuenta publicitaria", ok: false, detalle: `${msg(e)} Revisa que el usuario del sistema tenga la cuenta asignada con control total.` }); }
    } else out.push({ item: "Cuenta publicitaria", ok: false, detalle: "Falta el ID." });
    if (c.pageId) {
      try { const p = await graph<{ name?: string }>(c.pageId, { params: { fields: "name" }, token: c.adsToken }); out.push({ item: "Página de Facebook", ok: true, detalle: p.name ?? "Conectada." }); }
      catch (e) { out.push({ item: "Página de Facebook", ok: false, detalle: `${msg(e)} Revisa que el usuario del sistema tenga la página asignada.` }); }
    } else out.push({ item: "Página de Facebook", ok: false, detalle: "Falta el ID." });
    if (c.igUserId) {
      try { const i = await graph<{ username?: string }>(c.igUserId, { params: { fields: "username" }, token: c.adsToken }); out.push({ item: "Instagram", ok: true, detalle: i.username ? `@${i.username}` : "Conectado." }); }
      catch (e) { out.push({ item: "Instagram", ok: false, detalle: `${msg(e)} La cuenta de Instagram tiene que ser profesional y estar unida a la página.` }); }
    }
  }
  const pixelToken = c.capiToken || c.adsToken;
  if (!pixelToken) out.push({ item: "Píxel", ok: true, detalle: `ID ${c.pixelId} en la web (sin token no se puede revisar más).` });
  else {
    try {
      const px = await graph<{ name?: string; last_fired_time?: string }>(c.pixelId, { params: { fields: "name,last_fired_time" }, token: pixelToken });
      out.push({ item: "Píxel", ok: true, detalle: `${px.name ?? c.pixelId}${px.last_fired_time ? ` · último evento ${new Date(px.last_fired_time).toLocaleString("es-CL")}` : " · todavía sin eventos"}` });
    } catch (e) { out.push({ item: "Píxel", ok: false, detalle: `${msg(e)} Revisa que el ID del píxel sea el correcto.` }); }
  }
  out.push(c.appSecret && c.webhookToken ? { item: "Respuestas a comentarios", ok: true, detalle: "Clave secreta y clave del webhook guardadas. Si Meta aceptó la URL al suscribirte, ya llegan los comentarios." } : { item: "Respuestas a comentarios (opcional)", ok: false, detalle: `Falta ${c.appSecret ? "" : "la clave secreta de la app"}${!c.appSecret && !c.webhookToken ? " y " : ""}${c.webhookToken ? "" : "crear la clave del webhook"} (sección «Respuestas automáticas a comentarios»).` });
  out.push(c.capiToken ? { item: "API de conversiones", ok: true, detalle: "Token guardado: las ventas y registros se avisan a Meta desde el servidor." } : { item: "API de conversiones", ok: false, detalle: "Falta el token (Administrador de eventos → tu píxel → Configuración → Generar token)." });
  return out;
}
