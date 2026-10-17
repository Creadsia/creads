import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { sbAll } from "@/lib/supabase";
import { type OrderRow, type Range, type StatRow, type WsRow, cohorts, compare, dayCL, itemName, paidIn, period, previousOf, statMap, sumBy } from "@/lib/stats";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD (owner only): sales, customers and visits for that range and the
// period of the same length right before, Shopify-style. Money in US$ (what the customer paid, IVA included).
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const today = dayCL();
  let r: Range = { from: q.get("from") ?? "", to: q.get("to") ?? "" };
  if (r.to > today) r.to = today;
  if (!DAY.test(r.from) || !DAY.test(r.to) || r.from > r.to) r = { from: today.slice(0, 8) + "01", to: today };
  const prev = previousOf(r);
  const since = new Date(Date.parse(`${prev.from}T00:00:00-04:00`) - 86400_000).toISOString();
  // cohorts look back 8 months; repeat customers need earlier purchases too, so read 13 months
  const back = new Date(Date.parse(`${today.slice(0, 7)}-01T12:00:00Z`)); back.setUTCMonth(back.getUTCMonth() - 13);
  const oldest = (since < back.toISOString() ? since : back.toISOString());
  try {
    const [orders, ws] = await Promise.all([
      // only what the two periods and the cohorts (8 months) need: the newest of the two dates
      sbAll<OrderRow>(`orders?select=id,owner,item,status,quote,visitor,created_at,closed_at&or=(created_at.gte.${oldest},closed_at.gte.${oldest})`, "created_at.asc,id.asc"),
      sbAll<WsRow>("workspaces?kind=eq.client&select=id,created_at", "created_at.asc,id.asc"),
    ]);
    let stats: StatRow[] = [];
    let statsReady = true;
    try { stats = await sbAll<StatRow>(`site_stats?day=gte.${prev.from}&day=lte.${r.to}&select=day,dim,key,n`, "day.asc,dim.asc,key.asc"); }
    catch { statsReady = false; }
    const recent = orders.filter((o) => (o.closed_at ?? o.created_at) >= since || o.created_at >= since);
    const cur = period(r, orders, ws, stats), before = period(prev, orders, ws, stats);
    const byProduct = (x: Range) => sumBy(paidIn(recent, x), itemName, (o) => Number(o.quote?.total) || 0);
    const bySource = (x: Range) => sumBy(paidIn(recent, x), (o) => o.visitor?.src || "sin dato", (o) => Number(o.quote?.total) || 0);
    return NextResponse.json({
      range: r, prev, statsReady, updated: new Date().toISOString(),
      cur, before,
      productos: compare(byProduct(r), byProduct(prev)),
      ventasFuente: compare(bySource(r), bySource(prev)),
      dispositivo: compare(statMap(stats, "dev", r), statMap(stats, "dev", prev)),
      ubicacion: compare(statMap(stats, "loc", r), statMap(stats, "loc", prev), 8),
      fuente: compare(statMap(stats, "src", r), statMap(stats, "src", prev), 8),
      paginas: compare(statMap(stats, "land", r), statMap(stats, "land", prev), 10),
      cohortes: cohorts(orders, ws, 8),
    });
  } catch (err) {
    const missing = Boolean((err as { missing?: boolean })?.missing);
    return NextResponse.json({ error: missing ? "Falta activar los pagos: ejecuta supabase/billing.sql en Supabase." : "No se pudieron leer las estadísticas." }, { status: 502 });
  }
}
