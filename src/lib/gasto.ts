// «Cuánto vendimos y cuánto gastamos» (owner, 22 Oct 2026): every day, exact where the provider lets us read
// it, estimated (and said so) where it doesn't. Feeds the owner's 9:00 email. Server-only.
//
// - Sales: the payments of the day; Mercado Pago's real fee read from each payment; IVA 19% included.
// - fal.ai (video + lips): real — the balance is read every Guardián round; what it drops is what fal charged.
// - Claude (Anthropic): real with an admin key (ANTHROPIC_ADMIN_KEY, Admin API cost report).
// - ElevenLabs: the monthly plan goes in fixed costs; the extra over the plan is read from the account.
// - Google (Nano Banana): estimated from what each image costs (no daily API).
// - Office agents: what the office recorded (Grok and Claude) — only when Claude's real cost isn't read.
// - Meta: real ad spend of the day (Marketing API).
// - Fixed costs: Panel → Costos fijos, per day.

import { readPrivateJSON, selectRows, writePrivateJSON } from "./supabase";
import { elevenUsage, falBalance, serviceOf } from "./balances";
import { DEFAULT_FINANZAS, type Finanzas, fijoMensual } from "./finance";
import { usdClpRate } from "./usd-clp";

export interface Line { usd: number | null; real: boolean; note?: string }
export interface DayLedger {
  day: string;
  ventas: { count: number; clp: number; usd: number; iva: number; mp: number; mpReal: boolean; neto: number };
  gastos: Record<"fal" | "claude" | "google" | "eleven" | "oficina" | "meta" | "fijos", Line>;
  gastoTotal: number;
  resultado: number;
  /** snapshots kept to compute the next day's deltas */
  marks?: { oficinaUsd?: number; elevenOverage?: number; month: string };
}

const IVA = 0.19;
const MP_FEE_ESTIMATE = 0.0415; // 3.49% + IVA, only when the payment can't be read
const dayAfter = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 86400_000).toISOString().slice(0, 10);
const dayBefore = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) - 86400_000).toISOString().slice(0, 10);
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------- fal.ai: balance snapshots ----------

const falFile = (day: string) => `gasto/fal/${day}.json`;
/** Called every Guardián round: notes fal.ai's real balance. */
export async function recordFalSnapshot() {
  const b = await falBalance(true).catch(() => null);
  if (!b?.ok) return;
  const day = new Date().toISOString().slice(0, 10);
  const list = (await readPrivateJSON<{ t: string; usd: number }[]>(falFile(day)).catch(() => null)) ?? [];
  const last = list[list.length - 1];
  if (last && Date.now() - Date.parse(last.t) < 4 * 60_000) return;
  await writePrivateJSON(falFile(day), [...list, { t: new Date().toISOString(), usd: b.usd }].slice(-400));
}
/** What fal.ai charged on a day: every drop of the balance (a rise is a top-up, not spend). */
async function falSpent(day: string): Promise<number | null> {
  const prev = (await readPrivateJSON<{ t: string; usd: number }[]>(falFile(dayBefore(day))).catch(() => null)) ?? [];
  const list = (await readPrivateJSON<{ t: string; usd: number }[]>(falFile(day)).catch(() => null)) ?? [];
  const next = (await readPrivateJSON<{ t: string; usd: number }[]>(falFile(dayAfter(day))).catch(() => null)) ?? [];
  const seq = [...prev.slice(-1), ...list, ...next.slice(0, 1)];
  if (list.length < 2) return null;
  let spent = 0;
  for (let i = 1; i < seq.length; i++) spent += Math.max(0, seq[i - 1].usd - seq[i].usd);
  return r2(spent);
}

// ---------- Claude: Admin API cost report (amounts come in cents) ----------

async function claudeSpent(day: string): Promise<number | null> {
  const key = process.env.ANTHROPIC_ADMIN_KEY;
  if (!key) return null;
  const q = new URLSearchParams({ starting_at: `${day}T00:00:00Z`, ending_at: `${dayAfter(day)}T00:00:00Z`, bucket_width: "1d", limit: "1" });
  const res = await fetch(`https://api.anthropic.com/v1/organizations/cost_report?${q}`, { headers: { "x-api-key": key, "anthropic-version": "2023-06-01" }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const d = (await res.json()) as { data?: { results?: { amount?: string; currency?: string }[] }[] };
  const cents = (d.data ?? []).flatMap((b) => b.results ?? []).filter((x) => (x.currency ?? "USD") === "USD").reduce((a, x) => a + (Number(x.amount) || 0), 0);
  return r2(cents / 100);
}

// ---------- the day ----------

const ledgerFile = (day: string) => `gasto/dias/${day}.json`;

export async function dayLedger(day: string): Promise<DayLedger> {
  const next = dayAfter(day);
  const month = day.slice(0, 7);
  const [rate, pays, clips, fin, prevLedger, fal, claude, eleven, office] = await Promise.all([
    usdClpRate().catch(() => 950),
    selectRows<{ id: string; amount: number; currency: string }>("payments", `select=id,amount,currency&created_at=gte.${day}&created_at=lt.${next}&limit=10000`).catch(() => []),
    selectRows<{ kind: string | null; model: string | null; usd: number | null }>("clips", `select=kind,model,usd&usd=gt.0&status=neq.failed&created_at=gte.${day}&created_at=lt.${next}&limit=100000`).catch(() => []),
    readPrivateJSON<Finanzas>("finanzas.json").catch(() => null),
    readPrivateJSON<DayLedger>(ledgerFile(dayBefore(day))).catch(() => null),
    falSpent(day).catch(() => null),
    claudeSpent(day).catch(() => null),
    elevenUsage(true).catch(() => null),
    import("./oficina").then((m) => m.loadState()).catch(() => null),
  ]);

  // sales: Mercado Pago's real fee from each payment when it can be read
  const { getPayment } = await import("./mercadopago");
  let clp = 0, usdOther = 0, mpClp = 0, mpReal = true;
  for (const p of pays) {
    const amt = Number(p.amount) || 0;
    if (p.currency === "CLP") clp += amt; else usdOther += amt;
    if (p.id.startsWith("mp:")) {
      const mp = await getPayment(p.id.slice(3)).catch(() => null);
      const fee = mp?.fee_details?.reduce((a, f) => a + (Number(f.amount) || 0), 0);
      if (fee !== undefined && mp) mpClp += fee; else { mpReal = false; mpClp += amt * MP_FEE_ESTIMATE; }
    }
  }
  const usd = clp / rate + usdOther;
  const iva = usd - usd / (1 + IVA);
  const mp = mpClp / rate;
  const ventas = { count: pays.length, clp: Math.round(clp), usd: r2(usd), iva: r2(iva), mp: r2(mp), mpReal, neto: r2(usd - iva - mp) };

  // recorded spend per service (the estimate behind each real reading)
  const rec = (svc: string) => r2(clips.filter((c) => serviceOf(c.kind, c.model) === svc).reduce((a, c) => a + Number(c.usd ?? 0), 0));
  const book = fin ?? DEFAULT_FINANZAS;
  const sameMonth = prevLedger?.marks?.month === month;
  const officeNow = office?.spend?.usd ?? null;
  const officeDelta = officeNow == null ? null : r2(Math.max(0, officeNow - (sameMonth ? prevLedger?.marks?.oficinaUsd ?? 0 : 0)));
  const overNow = eleven && eleven.ok ? eleven.overageUsd : null;
  const overDelta = overNow == null ? 0 : r2(Math.max(0, overNow - (sameMonth ? prevLedger?.marks?.elevenOverage ?? 0 : 0)));
  const meta = await import("./marketing").then((m) => m.metaSpendOn(day)).catch(() => null);

  const gastos: DayLedger["gastos"] = {
    fal: fal != null ? { usd: fal, real: true } : { usd: rec("fal"), real: false, note: "estimado: faltan lecturas del saldo" },
    claude: claude != null ? { usd: claude, real: true } : { usd: null, real: false, note: "falta ANTHROPIC_ADMIN_KEY" },
    google: { usd: rec("google"), real: false, note: "estimado por imagen" },
    eleven: { usd: overDelta, real: overNow != null, note: "solo lo que pasa del plan (el plan va en fijos)" },
    // with Claude's real cost read, the office's Claude part is already inside it
    oficina: { usd: claude != null ? null : officeDelta, real: false, note: claude != null ? "incluido en Claude (Grok aparte, poco)" : "lo que anotó la oficina" },
    meta: { usd: meta, real: meta != null, note: meta == null ? "Meta sin conectar" : undefined },
    fijos: { usd: r2(fijoMensual(book.fijos) / 30), real: false, note: "costos fijos ÷ 30" },
  };
  const gastoTotal = r2(Object.values(gastos).reduce((a, l) => a + (l.usd ?? 0), 0));
  const led: DayLedger = { day, ventas, gastos, gastoTotal, resultado: r2(ventas.neto - gastoTotal), marks: { month, oficinaUsd: officeNow ?? undefined, elevenOverage: overNow ?? undefined } };
  await writePrivateJSON(ledgerFile(day), led).catch(() => {});
  return led;
}

/** The month so far (from the 1st, or from «Empezar de cero» if later), adding the saved days. */
export async function monthToDate(day: string, since: string | null): Promise<{ from: string; vendido: number; neto: number; gastado: number; resultado: number; dias: number }> {
  const start = [`${day.slice(0, 7)}-01`, since?.slice(0, 10) ?? ""].sort().pop()!;
  let d = start, vendido = 0, neto = 0, gastado = 0, dias = 0;
  while (d <= day) {
    const l = await readPrivateJSON<DayLedger>(ledgerFile(d)).catch(() => null);
    if (l) { vendido += l.ventas.usd; neto += l.ventas.neto; gastado += l.gastoTotal; dias++; }
    d = dayAfter(d);
  }
  return { from: start, vendido: r2(vendido), neto: r2(neto), gastado: r2(gastado), resultado: r2(neto - gastado), dias };
}
