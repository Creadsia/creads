// «Suscripciones y retención» (owner, 22 Oct 2026): churn, retention, MRR movements, LTV and cancellation
// reasons, rebuilt from the payment history (an append-only log: one row per approved charge, never edited).
// Pure functions, no database access: the API route loads the rows and passes them in (tests do the same).
//
// How a subscription is rebuilt (same rule as apply_payment in supabase/billing.sql): each plan charge adds
// its months to the paid access, starting from the day it was paid or from the end of the access already
// paid, whichever is later. A charge that arrives up to GRACE_DAYS after the access ended continues the same
// subscription (Mercado Pago retries a failed renewal for a few days); a later one starts a new subscription
// (a reactivation). A requested cancellation is not churn: the customer is lost only when the paid access
// ends without a new charge (plus the grace days, unless they cancelled).

export const GRACE_DAYS = 7;
const DAY = 86_400_000;

export interface PayRow { id: string; order_id: string; owner: string; amount: number; currency: string; created_at: string }
export interface OrderLite { id: string; owner: string; item: string; period: string | null; mp?: { kind?: string; cancelled?: boolean } | null; visitor?: { src?: string; camp?: string } | null; created_at: string }
export interface Leave { ws: string; at: string; reason: string; detail?: string; plan?: string | null }
export interface PlanInfo { id: string; name: string; monthly: number; yearlyPerMonth: number }

/** One continuous subscription of a customer (from its first charge to the end of its paid access). */
export interface Spell {
  owner: string;
  start: number; // ms
  end: number; // ms: end of the paid access (may be in the future)
  /** When the customer stopped being active (end of access), or null while it's still active or in grace. */
  churnAt: number | null;
  /** Plan of each paid stretch, to price MRR at any moment. */
  stretches: { from: number; to: number; plan: string; mrr: number }[];
  charges: number;
  reactivation: boolean; // not their first subscription
  cancelled: boolean; // they turned off the renewal
  source: string | null; // acquisition channel, when known (never guessed)
  campaign: string | null;
}

const addMonths = (ms: number, n: number) => {
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.getTime();
};

/** Monthly recurring value of a plan charge, in US$ (list price: the launch discount of the first month isn't recurring). */
export function mrrOf(plans: PlanInfo[], item: string, period: string | null) {
  const p = plans.find((x) => x.id === item);
  if (!p) return 0;
  return period === "anual" ? p.yearlyPerMonth : p.monthly;
}

/** Every subscription, rebuilt from the plan charges. Top-ups (packs) don't make a subscription. */
export function buildSpells(pays: PayRow[], orders: OrderLite[], plans: PlanInfo[], now: number): Spell[] {
  const byOrder = new Map(orders.map((o) => [o.id, o]));
  const planIds = new Set(plans.map((p) => p.id));
  const seen = new Set<string>();
  const charges = pays
    .filter((p) => { if (seen.has(p.id)) return false; seen.add(p.id); return true; })
    .map((p) => ({ p, o: byOrder.get(p.order_id) }))
    .filter((x): x is { p: PayRow; o: OrderLite } => Boolean(x.o && planIds.has(x.o.item)))
    .sort((a, b) => Date.parse(a.p.created_at) - Date.parse(b.p.created_at));
  const byOwner = new Map<string, typeof charges>();
  for (const c of charges) byOwner.set(c.p.owner, [...(byOwner.get(c.p.owner) ?? []), c]);

  const out: Spell[] = [];
  for (const [owner, list] of byOwner) {
    let cur: Spell | null = null;
    let first = true;
    for (const { p, o } of list) {
      const at = Date.parse(p.created_at);
      const months = o.period === "anual" ? 12 : 1;
      const mrr = mrrOf(plans, o.item, o.period);
      if (cur && at <= cur.end + GRACE_DAYS * DAY) {
        const from = Math.max(cur.end, at);
        const to = addMonths(from, months);
        cur.stretches.push({ from, to, plan: o.item, mrr });
        cur.end = to;
        cur.charges++;
        cur.cancelled = Boolean(o.mp?.cancelled);
      } else {
        if (cur) out.push(cur);
        const to = addMonths(at, months);
        const src = o.visitor?.src && o.visitor.src !== "directo" ? o.visitor.src : o.visitor?.src === "directo" ? "directo" : null;
        cur = { owner, start: at, end: to, churnAt: null, stretches: [{ from: at, to, plan: o.item, mrr }], charges: 1, reactivation: !first, cancelled: Boolean(o.mp?.cancelled), source: src ?? null, campaign: o.visitor?.camp || null };
        first = false;
      }
    }
    if (cur) out.push(cur);
  }
  // a subscription is lost when its access ended and no charge came: right away if they cancelled, after the
  // grace days otherwise (Mercado Pago may still collect)
  for (const s of out) {
    const final = s.cancelled ? s.end : s.end + GRACE_DAYS * DAY;
    s.churnAt = now >= final ? s.end : null;
  }
  // an earlier spell of the same customer always ended (a later one exists)
  return out;
}

/** Active at instant t (a subscription in its grace days still counts as active). */
export const activeAt = (s: Spell, t: number) => s.start <= t && (s.churnAt == null ? true : t < s.churnAt);
/** The MRR a subscription brings at instant t (its last paid plan while in grace). */
export function mrrAt(s: Spell, t: number) {
  if (!activeAt(s, t)) return 0;
  const st = s.stretches.find((x) => x.from <= t && t < x.to) ?? s.stretches.filter((x) => x.from <= t).pop() ?? s.stretches[0];
  return st.mrr;
}
const planAt = (s: Spell, t: number) => (s.stretches.find((x) => x.from <= t && t < x.to) ?? s.stretches.filter((x) => x.from <= t).pop() ?? s.stretches[0]).plan;

export interface PeriodStats {
  from: number; to: number;
  base: number; // customers active at the start
  activosFin: number;
  nuevas: number; reactivaciones: number; renovaciones: number;
  perdidos: number; // base customers no longer active at the end
  canceladasEfectivas: number; // subscriptions whose access ended in the period (any customer)
  churn: number | null; retencion: number | null; // %
  mrrInicio: number; mrrFin: number; mrrPerdido: number; mrrContraccion: number; mrrExpansion: number; mrrNuevo: number;
  grossRevenueChurn: number | null; nrr: number | null; // %
}

/**
 * One period [from, to): churn = base customers (active at `from`) not active at `to` ÷ base. New customers of
 * the period are not in the denominator. A customer counts once even with two subscriptions.
 */
export function periodStats(spells: Spell[], from: number, to: number, plan?: string): PeriodStats {
  const filt = plan ? spells.filter((s) => s.stretches.some((x) => x.plan === plan)) : spells;
  const owners = new Map<string, Spell[]>();
  for (const s of filt) owners.set(s.owner, [...(owners.get(s.owner) ?? []), s]);
  const ownerActive = (list: Spell[], t: number) => list.some((s) => activeAt(s, t) && (!plan || planAt(s, t) === plan));
  const ownerMrr = (list: Spell[], t: number) => list.reduce((m, s) => m + (activeAt(s, t) && (!plan || planAt(s, t) === plan) ? mrrAt(s, t) : 0), 0);
  const end = to - 1;
  let base = 0, activosFin = 0, perdidos = 0, mrrInicio = 0, mrrFin = 0, mrrPerdido = 0, mrrContraccion = 0, mrrExpansion = 0, mrrNuevo = 0;
  for (const list of owners.values()) {
    const a = ownerActive(list, from), b = ownerActive(list, end);
    if (b) { activosFin++; mrrFin += ownerMrr(list, end); }
    if (!a) { if (b) mrrNuevo += ownerMrr(list, end); continue; }
    base++;
    const m0 = ownerMrr(list, from), m1 = b ? ownerMrr(list, end) : 0;
    mrrInicio += m0;
    if (!b) { perdidos++; mrrPerdido += m0; } else if (m1 > m0) mrrExpansion += m1 - m0; else mrrContraccion += m0 - m1;
  }
  const inP = (t: number) => t >= from && t < to;
  let nuevas = 0, reactivaciones = 0, renovaciones = 0, canceladasEfectivas = 0;
  for (const s of filt) {
    if (inP(s.start) && (!plan || s.stretches[0].plan === plan)) { if (s.reactivation) reactivaciones++; else nuevas++; }
    renovaciones += s.stretches.slice(1).filter((x) => inP(x.from) && (!plan || x.plan === plan)).length;
    if (s.churnAt != null && inP(s.churnAt) && (!plan || planAt(s, s.churnAt - 1) === plan)) canceladasEfectivas++;
  }
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
  return {
    from, to, base, activosFin, nuevas, reactivaciones, renovaciones, perdidos, canceladasEfectivas,
    churn: pct(perdidos, base), retencion: pct(base - perdidos, base),
    mrrInicio: r2(mrrInicio), mrrFin: r2(mrrFin), mrrPerdido: r2(mrrPerdido), mrrContraccion: r2(mrrContraccion), mrrExpansion: r2(mrrExpansion), mrrNuevo: r2(mrrNuevo),
    grossRevenueChurn: pct(mrrPerdido + mrrContraccion, mrrInicio),
    nrr: pct(mrrInicio + mrrExpansion - mrrContraccion - mrrPerdido, mrrInicio),
  };
}
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Average months a subscription lasted (ended ones) or has lasted so far (active ones). */
export function avgTenureMonths(spells: Spell[], now: number, plan?: string) {
  const list = plan ? spells.filter((s) => s.stretches[0].plan === plan) : spells;
  if (!list.length) return null;
  const days = list.reduce((t, s) => t + ((s.churnAt ?? now) - s.start) / DAY, 0) / list.length;
  return Math.round((days / 30.44) * 10) / 10;
}

/** Monthly cohorts (by first charge): customers, and the share still active at the end of each month after. */
export function cohortRetention(spells: Spell[], months: string[], monthStart: (m: string) => number, now: number) {
  const firstOf = new Map<string, number>();
  for (const s of spells) firstOf.set(s.owner, Math.min(firstOf.get(s.owner) ?? Infinity, s.start));
  const byOwner = new Map<string, Spell[]>();
  for (const s of spells) byOwner.set(s.owner, [...(byOwner.get(s.owner) ?? []), s]);
  return months.map((m, i) => {
    const a = monthStart(m), b = monthStart(nextMonth(m));
    const members = [...firstOf.entries()].filter(([, t]) => t >= a && t < b).map(([o]) => o);
    const cells: (number | null)[] = [];
    for (let k = 0; i + k < months.length; k++) {
      const at = Math.min(monthStart(nextMonth(months[i + k])) - 1, now);
      cells.push(members.length ? Math.round((members.filter((o) => (byOwner.get(o) ?? []).some((s) => activeAt(s, at))).length / members.length) * 1000) / 10 : null);
    }
    return { month: m, size: members.length, cells };
  });
}
export const nextMonth = (m: string) => { const [y, mo] = m.split("-").map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`; };

/** Real money collected per customer (observed LTV), in US$. */
export function observedLtv(pays: PayRow[], orders: OrderLite[], planIds: Set<string>, toUsd: (amount: number, currency: string) => number) {
  const byOrder = new Map(orders.map((o) => [o.id, o]));
  const seen = new Set<string>();
  const perOwner = new Map<string, number>();
  for (const p of pays) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    const o = byOrder.get(p.order_id);
    if (!o) continue;
    perOwner.set(p.owner, (perOwner.get(p.owner) ?? 0) + toUsd(Number(p.amount) || 0, p.currency));
  }
  const n = [...perOwner.keys()].filter((o) => pays.some((p) => p.owner === o && planIds.has(byOrder.get(p.order_id)?.item ?? ""))).length;
  const total = [...perOwner.values()].reduce((a, b) => a + b, 0);
  return { clientes: perOwner.size, conPlan: n, total: r2(total), porCliente: perOwner.size ? r2(total / perOwner.size) : null, perOwner };
}

/** Cancellation reasons, most frequent first (old wording mapped to the current options). */
export const REASONS = ["Precio demasiado elevado", "No utilizo suficientes créditos", "Resultados de IA insatisfactorios", "Problemas técnicos", "Ya no necesito la herramienta", "Me cambiaré a otra plataforma", "Otro motivo"] as const;
const OLD: Record<string, string> = { "Es muy caro": "Precio demasiado elevado", "No lo estoy usando": "No utilizo suficientes créditos", "La calidad no me convenció": "Resultados de IA insatisfactorios", "Me faltó una función": "Otro motivo", "Era solo para probar": "Ya no necesito la herramienta", Otro: "Otro motivo" };
export const reasonOf = (r: string) => OLD[r] ?? ((REASONS as readonly string[]).includes(r) ? r : "Sin motivo");
export function reasonCounts(leaves: Leave[]) {
  const m = new Map<string, number>();
  for (const l of leaves) { const k = reasonOf(l.reason); m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([motivo, n]) => ({ motivo, n }));
}
