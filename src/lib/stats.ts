// "Estadísticas" (Panel interno): sales, customers and visits, Shopify-style, for any date range compared
// with the period right before it. Visits are counted by Creads itself, anonymously and in aggregate
// (one row per day, dimension and key in site_stats: no IPs or personal data are stored; only known
// sources and pages are counted by name, so a script can't fill the table with junk). Pure functions
// here; the route in src/app/api/admin/estadisticas reads the database.

export type Dim = "ses" | "dev" | "loc" | "src" | "land";

/** The day in Chile (the business's calendar), as YYYY-MM-DD. */
export const dayCL = (d: Date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

export const isBot = (ua: string) => /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|axios|node-fetch/i.test(ua);

export function deviceOf(ua: string): "Móvil" | "Tableta" | "Escritorio" {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "Tableta";
  if (/mobi|iphone|ipod|android/i.test(ua)) return "Móvil";
  return "Escritorio";
}

/** Where a visit came from: the campaign tag first, then the page that sent it. */
export function sourceOf(o: { ref?: string; utm?: string; fbclid?: boolean; gclid?: boolean; host?: string }): string {
  const u = (o.utm ?? "").toLowerCase().trim();
  const named = (s: string) =>
    /instagram|\big\b/.test(s) ? "instagram" : /facebook|\bfb\b|meta/.test(s) ? "facebook" : /google|gads|adwords/.test(s) ? "google"
      : /tiktok/.test(s) ? "tiktok" : /youtube|youtu\.be/.test(s) ? "youtube" : /whatsapp|wa\.me/.test(s) ? "whatsapp"
        : /chatgpt|openai/.test(s) ? "chatgpt" : /linkedin|lnkd/.test(s) ? "linkedin" : /twitter|t\.co\b|x\.com/.test(s) ? "x" : "";
  if (u) return named(u) || (/^(email|correo|newsletter)$/.test(u) ? "email" : "otros");
  if (o.gclid) return "google";
  let host = "";
  try { host = o.ref ? new URL(o.ref).hostname.replace(/^www\./, "") : ""; } catch { host = ""; }
  const own = (o.host ?? "").replace(/^www\./, "");
  if (!host || (own && host.endsWith(own))) return o.fbclid ? "facebook" : "directo";
  return named(host) || (o.fbclid ? "facebook" : /bing\.|duckduckgo|yahoo\./.test(host) ? "buscadores" : "otros sitios");
}

/** Public pages counted by name; anything else (typos, junk sent by a script) is counted as "otra". */
const PAGES = /^\/(?:|es|en|estudio|empezar|terminos|privacidad|clave|app(?:\/[a-z-]+)?)$/;
/** A landing page without its query string, ids or tokens (so pages group together). */
export const landingOf = (path: string) => {
  const p = (String(path || "/").split(/[?#]/)[0].toLowerCase().replace(/\/[0-9a-z-]{16,}/g, "/:id").replace(/\/+$/, "") || "/").slice(0, 80);
  return PAGES.test(p === "/" ? "/" : p) ? p : "otra";
};

export interface OrderRow { id: string; owner: string; item: string; status: string; quote: { label?: string; subtotal?: number; launch?: number; discount?: number; total?: number } | null; visitor: { src?: string } | null; created_at: string; closed_at: string | null }
export interface WsRow { id: string; created_at: string }
export interface StatRow { day: string; dim: Dim; key: string; n: number }

export interface Range { from: string; to: string } // inclusive days, YYYY-MM-DD (Chile)

const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400_000) + 1;
export const dayList = (r: Range) => Array.from({ length: Math.max(1, daysBetween(r.from, r.to)) }, (_, i) => addDays(r.from, i));
/** The period of the same length right before. */
export const previousOf = (r: Range): Range => { const n = daysBetween(r.from, r.to); return { from: addDays(r.from, -n), to: addDays(r.from, -1) }; };

const inR = (d: string | null | undefined, r: Range) => Boolean(d) && d! >= r.from && d! <= r.to;
const dayOf = (iso: string | null | undefined) => (iso ? dayCL(new Date(iso)) : "");
const money = (n: unknown) => (Number.isFinite(Number(n)) ? Number(n) : 0);
const ITEM_NAME: Record<string, string> = { starter: "Plan Starter", plus: "Plan Plus", studio: "Plan Ultra", "pack-500": "Recarga 500", "pack-1000": "Recarga 1.000", "pack-3000": "Recarga 3.000", "pack-2000": "Recarga 2.000", "pack-5000": "Recarga 5.000" };
export const itemName = (o: OrderRow) => ITEM_NAME[o.item] ?? o.quote?.label ?? o.item;

export interface Period {
  bruto: number; descuentos: number; neto: number; pedidos: number; clientes: number; nuevos: number;
  habituales: number; // share of paying customers who had paid before or paid twice in the period
  sesiones: number; checkout: number; conversion: number; aov: number;
  daily: { day: string; ventas: number; pedidos: number; sesiones: number; nuevos: number; aov: number }[];
}

export function period(r: Range, orders: OrderRow[], ws: WsRow[], stats: StatRow[]): Period {
  const days = dayList(r);
  const paid = orders.filter((o) => o.status === "pagado" && inR(dayOf(o.closed_at ?? o.created_at), r));
  const byDay = new Map(days.map((d) => [d, { day: d, ventas: 0, pedidos: 0, sesiones: 0, nuevos: 0, aov: 0 }]));
  let bruto = 0, descuentos = 0, neto = 0;
  for (const o of paid) {
    const q = o.quote ?? {};
    const total = money(q.total), sub = money(q.subtotal) || total;
    bruto += sub; neto += total; descuentos += Math.max(0, sub - total);
    const d = byDay.get(dayOf(o.closed_at ?? o.created_at));
    if (d) { d.ventas += total; d.pedidos++; }
  }
  for (const w of ws) { const d = byDay.get(dayOf(w.created_at)); if (d) d.nuevos++; }
  for (const s of stats) if (s.dim === "ses" && s.key === "all") { const d = byDay.get(s.day); if (d) d.sesiones += s.n; }
  for (const d of byDay.values()) d.aov = d.pedidos ? d.ventas / d.pedidos : 0;
  const payers = new Map<string, number>();
  for (const o of paid) payers.set(o.owner, (payers.get(o.owner) ?? 0) + 1);
  const before = new Set(orders.filter((o) => o.status === "pagado" && dayOf(o.closed_at ?? o.created_at) < r.from).map((o) => o.owner));
  const repeat = [...payers.entries()].filter(([w, n]) => n > 1 || before.has(w)).length;
  const sesiones = [...byDay.values()].reduce((a, d) => a + d.sesiones, 0);
  const nuevos = ws.filter((w) => inR(dayOf(w.created_at), r)).length;
  const checkout = orders.filter((o) => inR(dayOf(o.created_at), r)).length;
  return {
    bruto: round(bruto), descuentos: round(descuentos), neto: round(neto), pedidos: paid.length, clientes: payers.size, nuevos,
    habituales: payers.size ? repeat / payers.size : 0, sesiones, checkout,
    conversion: sesiones ? paid.length / sesiones : 0, aov: paid.length ? round(neto / paid.length) : 0,
    daily: [...byDay.values()].map((d) => ({ ...d, ventas: round(d.ventas), aov: round(d.aov) })),
  };
}
const round = (n: number) => Math.round(n * 100) / 100;

/** Amount per key in the current and previous period, biggest first. */
export function compare(cur: Map<string, number>, prev: Map<string, number>, limit = 8) {
  return [...new Set([...cur.keys(), ...prev.keys()])].map((k) => ({ k, n: round(cur.get(k) ?? 0), prev: round(prev.get(k) ?? 0) }))
    .filter((x) => x.n > 0 || x.prev > 0).sort((a, b) => b.n - a.n || b.prev - a.prev).slice(0, limit);
}
export const sumBy = <T,>(rows: T[], key: (x: T) => string, val: (x: T) => number) => { const m = new Map<string, number>(); for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + val(r)); return m; };
export const statMap = (rows: StatRow[], dim: Dim, r: Range) => sumBy(rows.filter((s) => s.dim === dim && inR(s.day, r)), (s) => s.key, (s) => s.n);
export const paidIn = (orders: OrderRow[], r: Range) => orders.filter((o) => o.status === "pagado" && inR(dayOf(o.closed_at ?? o.created_at), r));

/**
 * Cohorts: of the accounts created each month, the share that paid in their first month (0), the next (1)…
 * Only months that already happened are filled.
 */
export function cohorts(orders: OrderRow[], ws: WsRow[], months = 8, now = new Date()) {
  const mk = (d: string) => d.slice(0, 7);
  const cur = mk(dayCL(now));
  const list: string[] = [];
  const [y, m] = cur.split("-").map(Number);
  for (let i = months - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 15)); list.push(d.toISOString().slice(0, 7)); }
  const paidMonths = new Map<string, Set<string>>();
  for (const o of orders) if (o.status === "pagado") { const k = mk(dayOf(o.closed_at ?? o.created_at)); if (!paidMonths.has(o.owner)) paidMonths.set(o.owner, new Set()); paidMonths.get(o.owner)!.add(k); }
  return list.map((month, i) => {
    const members = ws.filter((w) => mk(dayOf(w.created_at)) === month);
    const cells = Array.from({ length: months - i }, (_, k) => {
      const target = list[i + k];
      const n = members.filter((w) => paidMonths.get(w.id)?.has(target)).length;
      return members.length ? n / members.length : 0;
    });
    return { month, size: members.length, cells };
  });
}
