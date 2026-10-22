import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { sbAll } from "@/lib/supabase";
import { type OrderRow, type WsRow, dayCL } from "@/lib/stats";
import { metaRange } from "@/lib/marketing";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const META_SRC = new Set(["facebook", "instagram"]);

// GET ?from&to (owner only) → Panel → Campañas: Meta (spend, clicks, what Meta attributes) next to what really
// happened in Creads (accounts, checkouts started, sales and money), per day and in total, in US$.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const today = dayCL();
  let from = q.get("from") ?? "", to = q.get("to") ?? "";
  if (to > today) to = today;
  if (!DAY.test(from) || !DAY.test(to) || from > to) { from = `${today.slice(0, 8)}01`; to = today; }
  const since = new Date(Date.parse(`${from}T00:00:00-04:00`) - 86400_000).toISOString();
  const day = (iso: string | null | undefined) => (iso ? dayCL(new Date(iso)) : "");
  const inR = (d: string) => d >= from && d <= to;

  const [orders, ws, meta] = await Promise.all([
    sbAll<OrderRow>(`orders?select=id,owner,item,status,quote,visitor,created_at,closed_at&or=(created_at.gte.${since},closed_at.gte.${since})`, "created_at.asc,id.asc").catch(() => [] as OrderRow[]),
    sbAll<WsRow>(`workspaces?kind=eq.client&created_at=gte.${since}&select=id,created_at`, "created_at.asc,id.asc").catch(() => [] as WsRow[]),
    metaRange(from, to).catch((e: unknown) => ({ connected: false as const, error: e instanceof Error ? e.message.slice(0, 200) : "Meta no respondió." })),
  ]);

  // Creads, per day
  const days: string[] = [];
  for (let d = from; d <= to; d = new Date(Date.parse(`${d}T12:00:00Z`) + 86400_000).toISOString().slice(0, 10)) days.push(d);
  const blank = () => ({ cuentas: 0, pagosIniciados: 0, ventas: 0, ventasMeta: 0, ingresos: 0, ingresosMeta: 0 });
  const creads = new Map(days.map((d) => [d, blank()]));
  for (const w of ws) { const d = day(w.created_at); if (inR(d)) creads.get(d)!.cuentas++; }
  for (const o of orders) {
    if (o.status === "reemplazado") continue;
    const c = day(o.created_at);
    if (inR(c)) creads.get(c)!.pagosIniciados++;
    if (o.status !== "pagado") continue;
    const p = day(o.closed_at ?? o.created_at);
    if (!inR(p)) continue;
    const r = creads.get(p)!, usd = Number(o.quote?.total) || 0, fromMeta = META_SRC.has(o.visitor?.src ?? "");
    r.ventas++; r.ingresos += usd;
    if (fromMeta) { r.ventasMeta++; r.ingresosMeta += usd; }
  }
  const mDays = meta.connected && "days" in meta ? meta.days ?? [] : [];
  const metaDays = new Map(mDays.map((m) => [m.day, m]));
  const porDia = days.map((d) => ({ day: d, ...creads.get(d)!, meta: metaDays.get(d) ?? null }));
  const sum = <K extends string>(rows: Record<K, number>[], k: K) => rows.reduce((t, r) => t + (Number(r[k]) || 0), 0);
  const totC = porDia.map((x) => x as unknown as Record<string, number>);
  const total = {
    gasto: +sum(mDays, "spend").toFixed(2), impresiones: sum(mDays, "impressions"), clics: sum(mDays, "clicks"),
    metaRegistros: sum(mDays, "regs"), metaPagos: sum(mDays, "checkouts"), metaCompras: sum(mDays, "buys"), metaValor: +sum(mDays, "buyValue").toFixed(2),
    cuentas: sum(totC, "cuentas"), pagosIniciados: sum(totC, "pagosIniciados"), ventas: sum(totC, "ventas"), ventasMeta: sum(totC, "ventasMeta"),
    ingresos: +sum(totC, "ingresos").toFixed(2), ingresosMeta: +sum(totC, "ingresosMeta").toFixed(2),
  };
  return NextResponse.json({
    range: { from, to }, updated: new Date().toISOString(),
    meta: { connected: meta.connected, error: "error" in meta ? meta.error : undefined, campaigns: meta.connected && "campaigns" in meta ? meta.campaigns ?? [] : [] },
    total, porDia,
  });
}
