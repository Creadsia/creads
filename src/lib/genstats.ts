import { readPrivateJSON, sbRest, writePrivateJSON } from "./supabase";
import { alarm } from "./errlog";
import { findTool } from "./tools";

// How generations are going: per model or tool, how many were made, how many failed, what the failed
// ones would have cost if the provider charged for them, and how many credits went back to customers.
// A spike of failures sends the owner an alarm (checked at most every 15 minutes).

export interface GenRow { label: string; total: number; failed: number; rate: number; failedUsd: number }
export interface GenStats { hours: number; total: number; failed: number; rate: number; failedUsd: number; refunded: number; rows: GenRow[] }

function labelOf(c: { kind: string | null; model: string | null; ad_id: string | null }) {
  const k = c.kind ?? "";
  if (k.startsWith("tool:")) return `Herramienta · ${findTool(k.slice(5))?.name ?? k.slice(5)}`;
  if (k === "gen:image") return `Imagen · ${c.model ?? "?"}`;
  if (k.startsWith("shot")) return `Historia · ${c.model ?? "?"}`;
  if (c.ad_id) return `Anuncio · ${c.model ?? "?"}`;
  return `Video · ${c.model ?? "?"}`;
}

export function summarizeGen(clips: { status: string; kind: string | null; model: string | null; usd: number | null; ad_id: string | null }[], hours: number, refunded = 0): GenStats {
  const m = new Map<string, GenRow>();
  for (const c of clips) {
    if (c.status === "pending") continue; // never started: nothing was asked of a provider
    const label = labelOf(c);
    const r = m.get(label) ?? { label, total: 0, failed: 0, rate: 0, failedUsd: 0 };
    r.total++;
    if (c.status === "failed") { r.failed++; r.failedUsd += Number(c.usd ?? 0); }
    m.set(label, r);
  }
  const rows = [...m.values()].map((r) => ({ ...r, rate: r.total ? r.failed / r.total : 0, failedUsd: +r.failedUsd.toFixed(2) })).sort((a, b) => b.failed - a.failed || b.total - a.total);
  const total = rows.reduce((a, r) => a + r.total, 0), failed = rows.reduce((a, r) => a + r.failed, 0);
  return { hours, total, failed, rate: total ? failed / total : 0, failedUsd: +rows.reduce((a, r) => a + r.failedUsd, 0).toFixed(2), refunded, rows };
}

export async function genStats(hours: number): Promise<GenStats> {
  const since = new Date(Date.now() - hours * 3600_000).toISOString();
  const [clips, refunds] = await Promise.all([
    sbRest<{ status: string; kind: string | null; model: string | null; usd: number | null; ad_id: string | null }[]>(`clips?created_at=gte.${since}&select=status,kind,model,usd,ad_id&limit=50000`).catch(() => []),
    sbRest<{ delta: number }[]>(`credits?kind=eq.refund&created_at=gte.${since}&select=delta&limit=50000`).catch(() => []),
  ]);
  return summarizeGen(clips, hours, refunds.reduce((a, r) => a + Number(r.delta || 0), 0));
}

/** Problems worth an alarm in these numbers. */
export function spikes(s: GenStats): { key: string; title: string; detail: string }[] {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const out: { key: string; title: string; detail: string }[] = [];
  if (s.total >= 10 && s.rate >= 0.2) out.push({ key: "fallas:todas", title: `Están fallando muchas generaciones (${pct(s.rate)})`, detail: `En las últimas ${s.hours} h fallaron ${s.failed} de ${s.total} generaciones. Revisa saldos de los proveedores y el estado de los modelos.` });
  for (const r of s.rows) if (r.total >= 5 && r.rate >= 0.4) out.push({ key: `fallas:${r.label}`, title: `${r.label}: falla el ${pct(r.rate)}`, detail: `En las últimas ${s.hours} h fallaron ${r.failed} de ${r.total}. Si sigue así, conviene ocultar ese modelo o revisar su saldo.` });
  return out;
}

const STAMP = "errores/vigilancia.json";
let lastLocal = 0;

/** Checks the last 24 h and sends alarms (at most every 15 min across all servers). Never throws. */
export async function watchFailures(force = false) {
  try {
    if (!force && Date.now() - lastLocal < 15 * 60_000) return;
    lastLocal = Date.now();
    const st = (await readPrivateJSON<{ at: number }>(STAMP)) ?? { at: 0 };
    if (!force && Date.now() - st.at < 15 * 60_000) return;
    await writePrivateJSON(STAMP, { at: Date.now() });
    const s = await genStats(24);
    for (const sp of spikes(s)) await alarm(sp.key, { title: sp.title, detail: sp.detail, rows: [["Generaciones (24 h)", String(s.total)], ["Fallidas", String(s.failed)], ["Créditos devueltos", s.refunded.toLocaleString("es-CL")]] });
  } catch (err) {
    console.error("watchFailures", err instanceof Error ? err.message : err);
  }
}
