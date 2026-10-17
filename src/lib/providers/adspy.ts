// "Espiar anuncios": the Meta Ad Library through Scrape Creators (server only; key SCRAPECREATORS_API_KEY).
// Customers never see the service's name. The reply format isn't formally documented, so the parsing
// below accepts the shapes the Ad Library uses (snake_case snapshot fields) and skips what it can't read.

const BASE = "https://api.scrapecreators.com/v1/facebook/adLibrary";

export interface SpyAd {
  id: string;
  page: string;
  pageImage: string | null;
  text: string;
  title: string | null;
  cta: string | null;
  link: string | null;
  video: string | null;
  poster: string | null;
  image: string | null;
  start: string | null; // ISO date the ad started running
  days: number | null; // days running so far (or until it stopped)
  active: boolean;
  copies: number; // versions of the same ad running (a sign the advertiser is scaling it)
  platforms: string[];
}

export const adSpyConfigured = () => Boolean(process.env.SCRAPECREATORS_API_KEY);

async function call(path: string, params: Record<string, string | undefined>) {
  const key = process.env.SCRAPECREATORS_API_KEY;
  if (!key) throw new Error("Falta SCRAPECREATORS_API_KEY en Vercel.");
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  const res = await fetch(`${BASE}${path}?${qs}`, { headers: { "x-api-key": key }, cache: "no-store", signal: AbortSignal.timeout(45_000) });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = String(data?.message ?? data?.error ?? `status ${res.status}`);
    console.error("adspy error", res.status, msg.slice(0, 300));
    if (res.status === 402 || /credit/i.test(msg)) throw new Error("adspy: insufficient credits");
    throw new Error(`adspy: ${res.status}`);
  }
  return data as Record<string, unknown>;
}

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (...vals: unknown[]) => { for (const v of vals) if (typeof v === "string" && v.trim()) return v.trim(); return null; };
const httpsOnly = (u: string | null) => (u && /^https:\/\//.test(u) ? u : null);

/** A date from the Ad Library: seconds, milliseconds or text. */
function toDate(v: unknown): Date | null {
  if (typeof v === "number" && v > 0) return new Date(v < 1e12 ? v * 1000 : v);
  if (typeof v === "string" && v) { const n = Number(v); const d = Number.isFinite(n) && n > 0 ? new Date(n < 1e12 ? n * 1000 : n) : new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
  return null;
}

/** One result of the Ad Library, made safe and small. Null if it has nothing to show. */
export function readAd(raw: unknown, now = Date.now()): SpyAd | null {
  const r = o(raw);
  const snap = o(r.snapshot);
  const cards = Array.isArray(snap.cards) ? snap.cards.map(o) : [];
  const vids = (Array.isArray(snap.videos) ? snap.videos.map(o) : []).concat(cards);
  const imgs = (Array.isArray(snap.images) ? snap.images.map(o) : []).concat(cards);
  const video = httpsOnly(str(...vids.flatMap((v) => [v.video_hd_url, v.video_sd_url])));
  const poster = httpsOnly(str(...vids.map((v) => v.video_preview_image_url)));
  const image = httpsOnly(str(...imgs.flatMap((i) => [i.original_image_url, i.resized_image_url])));
  const body = o(snap.body);
  // dynamic ads keep the text as "{{product.name}}"-style placeholders: use the first card instead
  const rawText = str(body.text, typeof snap.body === "string" ? snap.body : null, cards[0]?.body) ?? "";
  const text = /\{\{.*\}\}/.test(rawText) ? str(cards[0]?.body) ?? "" : rawText;
  const id = str(r.ad_archive_id, r.adArchiveID, r.id, typeof r.ad_archive_id === "number" ? String(r.ad_archive_id) : null);
  if (!id || (!video && !image && !text)) return null;
  const start = toDate(r.start_date ?? r.startDate);
  const end = toDate(r.end_date ?? r.endDate);
  const active = r.is_active !== false && r.isActive !== false;
  const until = active || !end ? now : end.getTime();
  return {
    id: String(id).replace(/\D/g, "").slice(0, 30) || String(id).slice(0, 30),
    page: str(r.page_name, snap.page_name, r.pageName) ?? "Anunciante",
    pageImage: httpsOnly(str(snap.page_profile_picture_url)),
    text: text.slice(0, 3000),
    title: str(snap.title, cards[0]?.title)?.slice(0, 200) ?? null,
    cta: str(snap.cta_text, cards[0]?.cta_text)?.slice(0, 60) ?? null,
    link: httpsOnly(str(snap.link_url, cards[0]?.link_url)),
    video,
    poster,
    image,
    start: start ? start.toISOString().slice(0, 10) : null,
    days: start ? Math.max(0, Math.round((until - start.getTime()) / 86_400_000)) : null,
    active,
    copies: Math.max(1, Number(r.collation_count ?? r.collationCount ?? 1) || 1),
    platforms: (Array.isArray(r.publisher_platform) ? r.publisher_platform : Array.isArray(r.publisherPlatform) ? r.publisherPlatform : []).map(String).slice(0, 6),
  };
}

function listOf(data: Obj): unknown[] {
  for (const k of ["searchResults", "results", "ads", "data"]) if (Array.isArray(data[k])) return data[k] as unknown[];
  return [];
}

export interface SpySearch { query: string; country?: string; cursor?: string; video?: boolean }

/** Active ads matching a keyword in one country (or everywhere). */
export async function searchAds(s: SpySearch): Promise<{ ads: SpyAd[]; cursor: string | null }> {
  const data = await call("/search/ads", {
    query: s.query,
    country: s.country || "ALL",
    status: "ACTIVE",
    media_type: s.video ? "VIDEO" : "ALL",
    cursor: s.cursor,
  });
  const seen = new Set<string>();
  const ads = listOf(data).map((x) => readAd(x)).filter((a): a is SpyAd => Boolean(a) && !seen.has(a!.id) && Boolean(seen.add(a!.id)));
  return { ads, cursor: str(data.cursor, o(data.paging).cursor) };
}

/** What the person in the ad says (video ads). Empty if there's nothing to transcribe. */
export async function adTranscript(id: string): Promise<string> {
  const data = await call("/ad/transcript", { id, cache_max_age: "30" });
  const segs = Array.isArray(data.segments) ? data.segments.map((x) => str(o(x).text) ?? "").join(" ") : "";
  return (str(data.transcript, data.text, o(data.data).transcript, segs) ?? "").slice(0, 6000);
}
