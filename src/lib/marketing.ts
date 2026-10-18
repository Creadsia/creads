import { readPrivateJSON, sbRest, sbRpc, writePrivateJSON } from "./supabase";
import { MetaError, budgetUnits, graph, metaAds, metaToken, unitsToUsd } from "./meta-graph";
import { observedDollar, usdClpRate } from "./usd-clp";
import { FORMATS } from "./formats";
import { TO_CREAR_KEY } from "./guiones";

// The owner's marketing studio: paid campaigns in Meta and organic content on the brand's Instagram
// accounts, run by the office agents (Director de Marketing, Creativos, Trafficker, Contenido orgánico).
// Rules:
// - every move is proposed by an agent and done only when the owner presses «Aprobar» (lib/oficina.ts);
// - campaigns are created PAUSED; turning one on or raising a budget can never pass the daily cap;
// - until Meta is connected everything works in «modo ensayo»: the move is saved, Meta isn't touched;
// - organic accounts are the brand's own and say so; auto-replies come from the account, as the account.

export interface Cuenta { id: string; nombre: string; igUserId: string; pageId?: string }
export interface AutoReply { on: boolean; palabras: string[]; mensaje: string; publico: string; maxPorHora: number }
export interface Pedido { id: string; at: string; titulo: string; formato: string; idioma: "es-CL" | "en"; guion: string; idea: string; estado: "pendiente" | "en producción" | "listo" }
export interface CampanaSpec {
  nombre: string; objetivo: "leads" | "trafico" | "ventas"; paises: string[]; edadMin: number; edadMax: number;
  presupuestoUsd: number; link: string; texto: string; titulo: string; cta: string; adId: string;
}
export interface CampanaRow { id: string; at: string; spec: CampanaSpec; estado: "ensayo" | "subida en pausa" | "activa" | "pausada" | "error"; metaId?: string; adsetId?: string; adId?: string; error?: string }
export type Destino = "instagram" | "facebook" | "ambos";
export interface Publicacion { id: string; at: string; cuenta: string; adId: string; texto: string; estado: "ensayo" | "publicada" | "error"; destino?: Destino; mediaId?: string; fbId?: string; error?: string }
export interface MarketingState {
  capUsd: number; // max US$ per day across all active campaigns
  cuentas: Cuenta[];
  autoReply: AutoReply;
  pedidos: Pedido[];
  campanas: CampanaRow[];
  publicaciones: Publicacion[];
  respuestas: { day: string; count: number; hour: string; hourCount: number; seen: string[] };
}

const FILE = "marketing/estado.json";
export const DEFAULT_MARKETING = (): MarketingState => ({
  capUsd: 30,
  cuentas: [],
  autoReply: {
    on: false,
    palabras: ["dónde", "donde", "cómo lo hicieron", "como lo hicieron", "qué app", "que app", "link", "info"],
    mensaje: "¡Gracias! 🙌 Este video lo hicimos con Creads IA. Si quieres hacer los tuyos, aquí puedes probar: https://www.creadsia.com",
    publico: "¡Gracias! Te escribimos por mensaje 🙌",
    maxPorHora: 30,
  },
  pedidos: [], campanas: [], publicaciones: [],
  respuestas: { day: "", count: 0, hour: "", hourCount: 0, seen: [] },
});

export async function loadMarketing(): Promise<MarketingState> {
  const s = await readPrivateJSON<Partial<MarketingState>>(FILE);
  const d = DEFAULT_MARKETING();
  return { ...d, ...(s ?? {}), autoReply: { ...d.autoReply, ...(s?.autoReply ?? {}) }, respuestas: { ...d.respuestas, ...(s?.respuestas ?? {}) } };
}
export async function commitMarketing(mutate: (s: MarketingState) => void) {
  const s = await loadMarketing();
  mutate(s);
  await writePrivateJSON(FILE, s);
  return s;
}

/**
 * An atomic «only once / at most N» check in the database (the same counter as the rate limits), so two
 * requests at the same time can't both pass. Fails closed: if it can't be checked, the answer is no.
 */
export async function once(key: string, windowSec: number, max = 1) {
  try { return Boolean(await sbRpc<boolean>("hit_rate", { p_key: key.slice(0, 200), p_window: windowSec, p_max: max })); } catch { return false; }
}
/** How many times a counter was hit in its current window (0 if unknown). */
async function hits(key: string) {
  const r = await sbRest<{ hits: number }[]>(`rate_limits?key=eq.${encodeURIComponent(key)}&select=hits&limit=1`).catch(() => []);
  return r[0]?.hits ?? 0;
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const clip = (v: unknown, n: number) => String(v ?? "").replace(/\u0000/g, "").trim().slice(0, n);

// ---------------------------------------------------------------- finished ads (the material)

export interface AdMaterial { id: string; title: string | null; format: string | null; final_url: string; created_at: string }
export async function finishedAds(limit = 20): Promise<AdMaterial[]> {
  return sbRest<AdMaterial[]>(`ads?owner=eq.main&final_url=not.is.null&select=id,title,format,final_url,created_at&order=created_at.desc&limit=${limit}`);
}
async function adVideo(adId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(adId)) throw new Error("Anuncio no válido.");
  const rows = await sbRest<AdMaterial[]>(`ads?id=eq.${adId}&owner=eq.main&final_url=not.is.null&select=id,title,format,final_url,created_at&limit=1`);
  if (!rows[0]) throw new Error("Ese anuncio no existe o no está terminado.");
  return rows[0];
}

// ---------------------------------------------------------------- ad requests (Creativos)

/** What the «Abrir en Crear anuncio» button needs (the studio reads it from sessionStorage). */
export const handoffKey = TO_CREAR_KEY;
export const addPedido = (p: Omit<Pedido, "id" | "at" | "estado">) =>
  commitMarketing((s) => { s.pedidos = [{ ...p, id: uid("ped"), at: new Date().toISOString(), estado: "pendiente" as const }, ...s.pedidos].slice(0, 60); });

// ---------------------------------------------------------------- paid campaigns (Trafficker)

async function account() {
  const cfg = await metaAds();
  if (!cfg) return null;
  const a = await graph<{ currency: string; account_status: number; name: string }>(cfg.account, { params: { fields: "currency,account_status,name" } });
  if (a.currency !== "USD" && a.currency !== "CLP") throw new MetaError(`La cuenta publicitaria está en ${a.currency}: por ahora el estudio maneja cuentas en USD o CLP.`);
  // the plain observed dollar (not the checkout's cushioned rate), so the cap in US$ is real
  const rate = a.currency === "CLP" ? (await observedDollar().catch(() => null))?.valor ?? (await usdClpRate()) : 1;
  return { cfg, currency: a.currency, rate, status: a.account_status, name: a.name };
}

interface MetaCampaign { id: string; name: string; status: string; effective_status: string; daily_budget?: string; objective: string; insights?: { data: Insight[] } }
interface Insight { spend?: string; impressions?: string; clicks?: string; ctr?: string; cpc?: string; frequency?: string; actions?: { action_type: string; value: string }[]; cost_per_action_type?: { action_type: string; value: string }[] }

/** Campaigns with their last 7 days, in US$ (empty while Meta isn't connected). */
export async function campaigns() {
  const acc = await account();
  if (!acc) return { connected: false as const, rows: [] as CampaignView[] };
  const r = await graph<{ data: MetaCampaign[] }>(`${acc.cfg.account}/campaigns`, { params: { fields: "id,name,status,effective_status,daily_budget,objective,insights.date_preset(last_7d){spend,impressions,clicks,ctr,cpc,frequency,actions,cost_per_action_type}", limit: 50 } });
  const rows = r.data.map((c): CampaignView => {
    const i = c.insights?.data?.[0] ?? {};
    const leads = Number(i.actions?.find((a) => /lead/.test(a.action_type))?.value ?? 0);
    const buys = Number(i.actions?.find((a) => /purchase/.test(a.action_type))?.value ?? 0);
    const spend = unitsToUsd(Number(i.spend ?? 0) * (acc.currency === "CLP" ? 1 : 100), acc.currency, acc.rate);
    return {
      id: c.id, nombre: c.name, estado: c.effective_status, objetivo: c.objective,
      presupuestoUsd: c.daily_budget ? +unitsToUsd(Number(c.daily_budget), acc.currency, acc.rate).toFixed(2) : null,
      gasto7d: +spend.toFixed(2), impresiones: Number(i.impressions ?? 0), clics: Number(i.clicks ?? 0), ctr: Number(i.ctr ?? 0), frecuencia: Number(i.frequency ?? 0),
      leads, compras: buys, costoPorLead: leads ? +(spend / leads).toFixed(2) : null,
    };
  });
  return { connected: true as const, rows, currency: acc.currency };
}
export interface CampaignView { id: string; nombre: string; estado: string; objetivo: string; presupuestoUsd: number | null; gasto7d: number; impresiones: number; clics: number; ctr: number; frecuencia: number; leads: number; compras: number; costoPorLead: number | null }

type Acc = NonNullable<Awaited<ReturnType<typeof account>>>;
interface BudgetInfo { id: string; account_id?: string; status: string; daily_budget?: string; lifetime_budget?: string; adsets?: { data: { id: string; status: string; daily_budget?: string; lifetime_budget?: string }[] } }
const BUDGET_FIELDS = "id,account_id,status,daily_budget,lifetime_budget,adsets.limit(100){id,status,daily_budget,lifetime_budget}";
/** A campaign's daily budget in US$: at campaign level, or the sum of its switched-on ad sets. Lifetime budgets are refused. */
function dailyOf(c: BudgetInfo, acc: Acc) {
  if (Number(c.lifetime_budget ?? 0) > 0 || (c.adsets?.data ?? []).some((a) => Number(a.lifetime_budget ?? 0) > 0)) {
    throw new MetaError("Hay campañas con presupuesto total (lifetime) en la cuenta: el estudio solo maneja presupuestos diarios. Cámbialas a diario en el Administrador de anuncios.");
  }
  if (Number(c.daily_budget ?? 0) > 0) return unitsToUsd(Number(c.daily_budget), acc.currency, acc.rate);
  return (c.adsets?.data ?? []).filter((a) => a.status === "ACTIVE").reduce((t, a) => t + unitsToUsd(Number(a.daily_budget ?? 0), acc.currency, acc.rate), 0);
}
/** US$ per day already committed by campaigns that are switched on (configured status, not delivery). */
async function activeDailyUsd(acc: Acc, except?: string) {
  const r = await graph<{ data: BudgetInfo[] }>(`${acc.cfg.account}/campaigns`, { params: { fields: BUDGET_FIELDS, limit: 200, filtering: [{ field: "status", operator: "IN", value: ["ACTIVE"] }] } });
  return r.data.filter((c) => c.id !== except && c.status === "ACTIVE").reduce((t, c) => t + dailyOf(c, acc), 0);
}
async function ownCampaign(acc: Acc, campaignId: string) {
  if (!/^\d{5,25}$/.test(campaignId)) throw new MetaError("Campaña no válida.");
  const c = await graph<BudgetInfo>(campaignId, { params: { fields: BUDGET_FIELDS } });
  if (`act_${c.account_id}` !== acc.cfg.account) throw new MetaError("Esa campaña no es de la cuenta publicitaria conectada.");
  return c;
}
/** Only one money move at a time (a second approval waits), so two moves can't both pass the same cap check. */
async function moneyLock() {
  if (!(await once("meta:money-move", 90))) throw new MetaError("Hay otro movimiento de plata en curso. Espera un minuto y aprueba de nuevo.");
}

const OBJECTIVE = { leads: "OUTCOME_LEADS", trafico: "OUTCOME_TRAFFIC", ventas: "OUTCOME_SALES" } as const;
const CTAS = new Set(["LEARN_MORE", "SIGN_UP", "SHOP_NOW", "GET_QUOTE", "CONTACT_US", "SUBSCRIBE", "APPLY_NOW", "DOWNLOAD"]);

/** Checks a campaign an agent wrote. Returns the clean spec or what's wrong. */
export function cleanCampaign(x: Record<string, unknown>, capUsd: number): CampanaSpec | string {
  const objetivo = x.objetivo === "trafico" || x.objetivo === "ventas" ? x.objetivo : "leads";
  const paises = (Array.isArray(x.paises) ? x.paises : ["CL"]).map((p) => String(p).toUpperCase()).filter((p) => /^[A-Z]{2}$/.test(p)).slice(0, 10);
  const edadMin = Math.max(18, Math.min(65, Math.round(Number(x.edadMin) || 25)));
  const edadMax = Math.max(edadMin, Math.min(65, Math.round(Number(x.edadMax) || 65)));
  const presupuestoUsd = Math.round((Number(x.presupuestoUsd) || 0) * 100) / 100;
  const link = clip(x.link, 300);
  const cta = CTAS.has(String(x.cta)) ? String(x.cta) : "LEARN_MORE";
  if (!paises.length) return "Faltan los países.";
  if (!(presupuestoUsd >= 1)) return "El presupuesto diario debe ser de al menos US$1.";
  if (presupuestoUsd > capUsd) return `El presupuesto (US$${presupuestoUsd}/día) pasa el tope diario de US$${capUsd}.`;
  let host = "";
  try { host = new URL(link).hostname; } catch { /* below */ }
  if (!/^https:\/\//.test(link) || !host) return "El link debe ser una dirección https completa.";
  if (!/^(www\.)?creadsia\.com$/.test(host)) return "Por ahora las campañas solo pueden llevar a creadsia.com.";
  if (!/^[0-9a-f-]{36}$/i.test(String(x.adId ?? ""))) return "Falta elegir el anuncio terminado de Creads (adId).";
  return {
    nombre: clip(x.nombre, 80) || "Campaña Creads", objetivo, paises, edadMin, edadMax, presupuestoUsd, link,
    texto: clip(x.texto, 600), titulo: clip(x.titulo, 60), cta, adId: String(x.adId),
  };
}

async function waitVideo(videoId: string, maxMs: number) {
  const end = Date.now() + Math.max(10_000, maxMs);
  while (Date.now() < end) {
    const v = await graph<{ status?: { video_status?: string } }>(videoId, { params: { fields: "status" } }).catch(() => null);
    if (v?.status?.video_status === "ready") return true;
    if (v?.status?.video_status === "error") throw new MetaError("Meta no pudo procesar el video.");
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new MetaError("Meta todavía está procesando el video. Aprueba de nuevo en unos minutos (la campaña a medias se borró).");
}

/**
 * Creates the whole campaign in Meta, PAUSED: campaign (budget at campaign level, Advantage+ audience),
 * ad set, the Creads video, the creative and the ad. Nothing spends until someone turns it on.
 * Returns null in «modo ensayo» (Meta not connected).
 */
export async function createPausedCampaign(spec: CampanaSpec): Promise<{ campaignId: string; adsetId: string; adId: string } | null> {
  const deadline = Date.now() + 240_000; // the approval runs inside a 300 s function: leave room to clean up
  const left = (cap: number) => Math.max(8_000, Math.min(cap, deadline - Date.now() - 20_000));
  const acc = await account();
  if (!acc) return null;
  const { cfg } = acc;
  const video = await adVideo(spec.adId);
  const created: string[] = [];
  try {
    const camp = await graph<{ id: string }>(`${cfg.account}/campaigns`, { method: "POST", params: {
      name: spec.nombre, objective: OBJECTIVE[spec.objetivo], status: "PAUSED", special_ad_categories: [],
      daily_budget: budgetUnits(spec.presupuestoUsd, acc.currency, acc.rate), bid_strategy: "LOWEST_COST_WITHOUT_CAP", buying_type: "AUCTION",
    } });
    created.push(camp.id);
    const conv = spec.objetivo !== "trafico" && cfg.pixel;
    const adset = await graph<{ id: string }>(`${cfg.account}/adsets`, { method: "POST", params: {
      name: `${spec.nombre} · público`, campaign_id: camp.id, status: "PAUSED", billing_event: "IMPRESSIONS",
      optimization_goal: conv ? "OFFSITE_CONVERSIONS" : "LINK_CLICKS",
      ...(conv ? { promoted_object: { pixel_id: cfg.pixel, custom_event_type: spec.objetivo === "ventas" ? "PURCHASE" : "LEAD" } } : {}),
      // with Advantage+ audience Meta takes the age as a suggestion (age_range); hard limits stay wide
      targeting: { geo_locations: { countries: spec.paises }, age_min: Math.min(spec.edadMin, 25), age_max: 65, age_range: [spec.edadMin, spec.edadMax], targeting_automation: { advantage_audience: 1 } },
    } });
    const vid = await graph<{ id: string }>(`${cfg.account}/advideos`, { method: "POST", params: { file_url: video.final_url, name: spec.nombre }, timeoutMs: left(100_000) });
    await waitVideo(vid.id, left(100_000) - 30_000);
    const thumbs = await graph<{ data: { uri: string; is_preferred?: boolean }[] }>(`${vid.id}/thumbnails`).catch(() => ({ data: [] }));
    const thumb = thumbs.data.find((t) => t.is_preferred)?.uri ?? thumbs.data[0]?.uri;
    if (!thumb) throw new MetaError("Meta todavía está procesando el video. Aprueba de nuevo en unos minutos.");
    const creative = await graph<{ id: string }>(`${cfg.account}/adcreatives`, { method: "POST", params: {
      name: `${spec.nombre} · video`,
      object_story_spec: {
        page_id: cfg.page, ...(cfg.ig ? { instagram_user_id: cfg.ig } : {}),
        video_data: { video_id: vid.id, image_url: thumb, message: spec.texto, title: spec.titulo, call_to_action: { type: spec.cta, value: { link: spec.link } } },
      },
    } });
    const ad = await graph<{ id: string }>(`${cfg.account}/ads`, { method: "POST", params: { name: `${spec.nombre} · anuncio`, adset_id: adset.id, creative: { creative_id: creative.id }, status: "PAUSED" } });
    return { campaignId: camp.id, adsetId: adset.id, adId: ad.id };
  } catch (e) {
    // a half-made campaign is removed so nothing incomplete stays in the account
    for (const id of created) await graph(id, { method: "DELETE" }).catch(() => {});
    throw e;
  }
}

/**
 * Turns a campaign on or off. Turning on never passes the daily cap (counting every switched-on campaign of
 * the account) and only switches on the ad set and ad the studio created, never ones paused by hand.
 */
export async function setCampaignStatus(campaignId: string, on: boolean, capUsd: number) {
  const acc = await account();
  if (!acc) return null;
  const c = await ownCampaign(acc, campaignId);
  if (on) {
    await moneyLock();
    const mine = dailyOf(c, acc);
    const others = await activeDailyUsd(acc, campaignId);
    if (others + mine > capUsd + 0.01) throw new MetaError(`Activarla dejaría US$${(others + mine).toFixed(2)}/día en campañas: pasa el tope de US$${capUsd}. Sube el tope en Marketing o pausa otra.`);
    const row = (await loadMarketing()).campanas.find((x) => x.metaId === campaignId);
    for (const id of [row?.adsetId, row?.adId]) if (id && /^\d{5,25}$/.test(id)) await graph(id, { method: "POST", params: { status: "ACTIVE" } });
  }
  await graph(campaignId, { method: "POST", params: { status: on ? "ACTIVE" : "PAUSED" } });
  await commitMarketing((m) => { const r = m.campanas.find((x) => x.metaId === campaignId); if (r) r.estado = on ? "activa" : "pausada"; }).catch(() => {});
  return true;
}

/** Changes a campaign's daily budget, never past the cap (counting the campaigns already switched on). */
export async function setCampaignBudget(campaignId: string, usd: number, capUsd: number) {
  const acc = await account();
  if (!acc) return null;
  if (!(usd >= 1)) throw new MetaError("El presupuesto debe ser de al menos US$1 al día.");
  const c = await ownCampaign(acc, campaignId);
  if (!(Number(c.daily_budget ?? 0) > 0)) throw new MetaError("Esa campaña no tiene presupuesto diario a nivel de campaña: cámbialo en el Administrador de anuncios.");
  await moneyLock();
  const others = c.status === "ACTIVE" ? await activeDailyUsd(acc, campaignId) : 0;
  if (others + usd > capUsd + 0.01) throw new MetaError(`Con ese presupuesto quedarían US$${(others + usd).toFixed(2)}/día en campañas: pasa el tope de US$${capUsd}.`);
  await graph(campaignId, { method: "POST", params: { daily_budget: budgetUnits(usd, acc.currency, acc.rate) } });
  return true;
}

// ---------------------------------------------------------------- organic (Contenido orgánico)

/** Publishes a finished Creads ad as a Reel on one of the brand's Instagram accounts. Null = modo ensayo. */
export async function publishReel(cuenta: Cuenta, adId: string, caption: string): Promise<string | null> {
  if (!(await metaToken())) return null;
  const video = await adVideo(adId);
  const c = await graph<{ id: string }>(`${cuenta.igUserId}/media`, { method: "POST", params: { media_type: "REELS", video_url: video.final_url, caption: caption.slice(0, 2200), share_to_feed: true } });
  const end = Date.now() + 150_000;
  for (;;) {
    const st = await graph<{ status_code?: string }>(c.id, { params: { fields: "status_code" } }).catch(() => ({ status_code: "" }));
    if (st.status_code === "FINISHED") break;
    if (st.status_code === "ERROR" || st.status_code === "EXPIRED") throw new MetaError("Instagram no pudo procesar el video.");
    if (Date.now() > end) throw new MetaError("Instagram se está demorando en procesar el video. Aprueba de nuevo en unos minutos.");
    await new Promise((r) => setTimeout(r, 6000));
  }
  const p = await graph<{ id: string }>(`${cuenta.igUserId}/media_publish`, { method: "POST", params: { creation_id: c.id } });
  return p.id;
}

/** Publishes a finished Creads ad as a video on the account's Facebook page. Null = modo ensayo. */
export async function publishFacebook(cuenta: Cuenta, adId: string, caption: string): Promise<string | null> {
  if (!(await metaToken())) return null;
  if (!cuenta.pageId) throw new MetaError(`La cuenta «${cuenta.nombre}» no tiene página de Facebook: agrégale el número de la página en Marketing.`);
  const video = await adVideo(adId);
  const token = await pageToken(cuenta.pageId);
  const r = await graph<{ id: string }>(`${cuenta.pageId}/videos`, { method: "POST", token, params: { file_url: video.final_url, description: caption.slice(0, 5000), published: true }, timeoutMs: 120_000 });
  return r.id;
}

/** Last posts of each account (for the agents): likes, comments and how many auto-replies went out. */
export async function organicSummary() {
  const s = await loadMarketing();
  const out: string[] = [];
  for (const c of s.cuentas.slice(0, 10)) {
    if (!(await metaToken())) { out.push(`${c.nombre}: (Meta sin conectar)`); continue; }
    const m = await graph<{ data: { caption?: string; like_count?: number; comments_count?: number; timestamp: string; media_product_type?: string }[] }>(`${c.igUserId}/media`, { params: { fields: "caption,like_count,comments_count,timestamp,media_product_type", limit: 10 } }).catch((e) => ({ data: [], error: e instanceof Error ? e.message : "" }) as never);
    out.push(`${c.nombre}: ${m.data.length ? m.data.map((p) => `${p.timestamp.slice(0, 10)} ${p.media_product_type ?? ""} ❤${p.like_count ?? 0} 💬${p.comments_count ?? 0} «${(p.caption ?? "").slice(0, 60)}»`).join(" | ") : "sin publicaciones o sin acceso"}`);
  }
  return `Cuentas orgánicas (${s.cuentas.length}):\n${out.map((x) => `- ${x}`).join("\n") || "- ninguna configurada"}\nRespuestas automáticas: ${s.autoReply.on ? "encendidas" : "apagadas"}; hoy ${await repliesToday()}.
Publicaciones recientes del estudio: ${s.publicaciones.slice(0, 8).map((p) => `${p.at.slice(0, 10)} ${p.cuenta} (${p.estado})`).join(" | ") || "ninguna"}`;
}

// ---------------------------------------------------------------- auto-replies (webhook)

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
/** Should this comment get the automatic reply? */
export function matchesKeywords(text: string, palabras: string[]) {
  const t = norm(text);
  return palabras.some((p) => p.trim() && t.includes(norm(p.trim())));
}

const pageTokens = new Map<string, { token: string; at: number }>();
/** The page's access token (private replies to Instagram comments go through the linked Facebook page). */
async function pageToken(pageId: string) {
  const hit = pageTokens.get(pageId);
  if (hit && Date.now() - hit.at < 3600_000) return hit.token;
  const r = await graph<{ access_token?: string }>(pageId, { params: { fields: "access_token" } });
  if (!r.access_token) throw new MetaError("No se pudo obtener el acceso de la página.");
  pageTokens.set(pageId, { token: r.access_token, at: Date.now() });
  return r.access_token;
}

/**
 * One Instagram comment from the webhook: replies once (Meta retries the same webhook), within the hourly
 * limit. The counters live in the database (atomic), never in the settings file the owner edits.
 */
export async function handleComment(c: { igUserId: string; commentId: string; text: string; fromId?: string }) {
  const s = await loadMarketing();
  const cuenta = s.cuentas.find((x) => x.igUserId === c.igUserId);
  if (!cuenta || !s.autoReply.on || !metaToken()) return "ignorado";
  if (c.fromId && c.fromId === c.igUserId) return "propio";
  if (s.autoReply.publico.trim() && c.text.trim() === s.autoReply.publico.trim()) return "propio";
  if (!/^\d{5,30}$/.test(c.commentId) || !matchesKeywords(c.text, s.autoReply.palabras)) return "sin palabra";
  if (!(await once(`igc:${c.commentId}`, 7 * 86400))) return "repetido";
  const hour = new Date().toISOString().slice(0, 13), day = new Date().toISOString().slice(0, 10);
  if (!(await once(`igr:${c.igUserId}:${hour}`, 3600, s.autoReply.maxPorHora))) return "límite";
  await once(`igd:${day}`, 86400, 1_000_000); // daily count for the panel
  if (cuenta.pageId) {
    const token = await pageToken(cuenta.pageId).catch(() => null);
    if (token) await graph(`${cuenta.pageId}/messages`, { method: "POST", token, params: { recipient: { comment_id: c.commentId }, message: { text: s.autoReply.mensaje.slice(0, 900) } } }).catch((e) => console.warn("auto-reply dm", e instanceof Error ? e.message : e));
  }
  if (s.autoReply.publico.trim()) await graph(`${c.commentId}/replies`, { method: "POST", params: { message: s.autoReply.publico.slice(0, 300) } }).catch((e) => console.warn("auto-reply public", e instanceof Error ? e.message : e));
  return "respondido";
}
/** Automatic replies sent today (for the panel and the agents). */
export const repliesToday = () => hits(`igd:${new Date().toISOString().slice(0, 10)}`);

/** What the agents read about paid campaigns. */
export async function paidSummary() {
  const s = await loadMarketing();
  const c = await campaigns();
  const head = c.connected ? `Meta conectado. Tope diario: US$${s.capUsd}.` : `Meta SIN conectar (modo ensayo). Tope diario: US$${s.capUsd}.`;
  return `${head}
Campañas (últimos 7 días):\n${c.rows.map((r) => `- [${r.id}] ${r.nombre} · ${r.estado} · ${r.objetivo} · US$${r.presupuestoUsd ?? "—"}/día · gastó US$${r.gasto7d} · CTR ${r.ctr.toFixed(2)}% · frecuencia ${r.frecuencia.toFixed(1)} · ${r.leads} leads${r.costoPorLead ? ` (US$${r.costoPorLead} c/u)` : ""}`).join("\n") || "- ninguna"}
Campañas propuestas por el estudio: ${s.campanas.slice(0, 8).map((x) => `${x.spec.nombre} (${x.estado})`).join(" | ") || "ninguna"}`;
}

/** What the agents read about the material: finished Creads ads and pending ad requests. */
export async function materialSummary() {
  const s = await loadMarketing();
  const ads = await finishedAds(15).catch(() => []);
  return `Anuncios de Creads terminados que se pueden usar (adId · título · formato · fecha):\n${ads.map((a) => `- ${a.id} · ${a.title ?? "sin título"} · ${a.format ?? ""} · ${a.created_at.slice(0, 10)}`).join("\n") || "- ninguno todavía"}
Pedidos de anuncios a Creads: ${s.pedidos.slice(0, 10).map((p) => `${p.titulo} (${p.estado})`).join(" | ") || "ninguno"}`;
}
