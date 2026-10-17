import { sbRest } from "./supabase";
import { overview } from "./balances";
import { usdClpRate } from "./usd-clp";
import type { DailyReport } from "./emails";

// Yesterday's numbers for the owner's morning email. Every part is best-effort: a part that can't be
// read shows 0 and the rest still goes out.

const day = (offset: number) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);

export async function dailyReport(extra: { expired: number; ending: number }): Promise<DailyReport> {
  const from = day(-1), to = day(0);
  const range = `created_at=gte.${from}&created_at=lt.${to}`;
  const [pays, users, clips, rate, money] = await Promise.all([
    sbRest<{ amount: number; currency: string }[]>(`payments?${range}&select=amount,currency&limit=10000`).catch(() => []),
    sbRest<{ id: string }[]>(`users?${range}&workspace=neq.main&select=id&limit=10000`).catch(() => []),
    sbRest<{ usd: number | null }[]>(`clips?${range}&usd=gt.0&status=neq.failed&select=usd&limit=100000`).catch(() => []),
    usdClpRate().catch(() => 950),
    overview(false).catch(() => null),
  ]);
  const clp = pays.filter((p) => p.currency === "CLP").reduce((s, p) => s + Number(p.amount || 0), 0);
  const usd = pays.filter((p) => p.currency !== "CLP").reduce((s, p) => s + Number(p.amount || 0), 0) + clp / rate;
  return {
    day: from,
    salesCount: pays.length,
    salesUsd: +usd.toFixed(2),
    salesClp: clp,
    signups: users.length,
    aiUsd: +clips.reduce((s, c) => s + Number(c.usd ?? 0), 0).toFixed(2),
    expired: extra.expired,
    ending: extra.ending,
    alerts: (money?.alerts ?? []).map((a) => a.text),
  };
}
