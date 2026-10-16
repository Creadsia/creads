import { randomUUID } from "node:crypto";
import type { User } from "./auth";
import { DEFAULT_USD_PER_CREDIT, creditsFor } from "./credit-math";
import type { Finanzas } from "./finance";
import { SbError, readPrivateJSON, sbRest, sbRpc } from "./supabase";

// Customers pay with credits. Every paid job is charged before it starts (so a customer can never
// spend more than they have) and refunded automatically if it fails. Creadsia's own workspace
// ("main") has no limit. Server-only; the ledger lives in public.credits (supabase/billing.sql).

export class CreditError extends Error {
  constructor(msg: string, public status = 402) {
    super(msg);
    this.name = "CreditError";
  }
}

const unlimited = (ws: string) => ws === "main";

let rateCache: { at: number; v: number } | null = null;
/** US$ of model cost per credit, from the owner's finance book (cached a minute). */
export async function usdPerCredit(): Promise<number> {
  if (rateCache && Date.now() - rateCache.at < 60_000) return rateCache.v;
  const book = await readPrivateJSON<Finanzas>("finanzas.json").catch(() => null);
  const v = Number(book?.config?.costoCredito);
  rateCache = { at: Date.now(), v: v > 0 ? v : DEFAULT_USD_PER_CREDIT };
  return rateCache.v;
}

interface WsBilling { discount: number; paid_until: string | null; plan: string | null }
async function billingOf(ws: string): Promise<WsBilling> {
  const rows = await sbRest<WsBilling[]>(`workspaces?id=eq.${encodeURIComponent(ws)}&select=discount,paid_until,plan&limit=1`);
  if (!rows.length) throw new CreditError("Cuenta no encontrada.", 403);
  return { discount: Number(rows[0].discount ?? 0), paid_until: rows[0].paid_until ?? null, plan: rows[0].plan ?? null };
}

const today = () => new Date().toISOString().slice(0, 10);
const expired = (b: WsBilling) => Boolean(b.paid_until && b.paid_until < today());

/** What a job costs this workspace, in credits. */
export async function priceFor(ws: string, usd: number) {
  if (unlimited(ws)) return 0;
  const [rate, b] = await Promise.all([usdPerCredit(), billingOf(ws)]);
  return creditsFor(usd, rate, b.discount);
}

export async function balanceOf(ws: string): Promise<number> {
  const r = await sbRpc<number>("credit_balance", { p_owner: ws });
  return Number(r ?? 0);
}

/** For the studio: what the customer has and how prices are computed. */
export async function creditStatus(ws: string) {
  const rate = await usdPerCredit();
  if (unlimited(ws)) return { unlimited: true, balance: null, rate, discount: 0, paidUntil: null, expired: false, plan: null };
  try {
    const [b, balance] = await Promise.all([billingOf(ws), balanceOf(ws)]);
    return { unlimited: false, balance, rate, discount: b.discount, paidUntil: b.paid_until, expired: expired(b), plan: b.plan };
  } catch (err) {
    if (err instanceof SbError && err.missing) return { unlimited: false, balance: 0, rate, discount: 0, paidUntil: null, expired: false, plan: null, notReady: true };
    throw err;
  }
}

export interface Charge { credits: number; ref: string; free: boolean }

/**
 * Charges a job before it starts. Throws CreditError (shown to the customer as is) when the plan
 * expired or the credits don't cover it. `ref` ties the charge to the job so a failure can refund it.
 */
export async function chargeJob(user: User, usd: number, note: string, ref: string = randomUUID(), opts: { free?: boolean } = {}): Promise<Charge> {
  const ws = user.workspace;
  if (unlimited(ws)) return { credits: 0, ref, free: true };
  try {
    const [rate, b] = await Promise.all([usdPerCredit(), billingOf(ws)]);
    if (expired(b)) throw new CreditError("Tu plan venció. Escríbenos a hola@creadsia.com para renovarlo.");
    const credits = creditsFor(usd, rate, b.discount);
    const rows = await sbRpc<{ ok: boolean; balance: number }[]>("spend_credits", {
      p_owner: ws, p_amount: credits, p_note: note.slice(0, 200), p_ref: ref, p_usd: +usd.toFixed(4), p_by: user.email, p_free: Boolean(opts.free),
    });
    const r = rows[0];
    if (!r?.ok) {
      throw new CreditError(`Te faltan créditos: esto usa ${credits.toLocaleString("es-CL")} y te quedan ${Number(r?.balance ?? 0).toLocaleString("es-CL")}. Pide más en hola@creadsia.com.`);
    }
    return { credits: opts.free ? 0 : credits, ref, free: Boolean(opts.free) };
  } catch (err) {
    if (err instanceof CreditError) throw err;
    // the credits system isn't set up yet: customers can't spend (fail closed)
    if (err instanceof SbError && err.missing) throw new CreditError("Los créditos aún no están activados. Escríbenos a hola@creadsia.com.", 503);
    throw new CreditError("No pudimos revisar tus créditos. Intenta de nuevo en un momento.", 503);
  }
}

/** Gives back the credits of a failed job (only once per charge). Never throws. */
export async function refundJob(ws: string, ref: string, note = "Devuelto: el trabajo falló") {
  if (unlimited(ws) || !ref) return 0;
  try {
    return Number((await sbRpc<number>("refund_last", { p_owner: ws, p_ref: ref, p_note: note })) ?? 0);
  } catch (err) {
    console.error("refund failed", ws, ref, err instanceof Error ? err.message : err);
    return 0;
  }
}

/** Free automatic redos already used, from the ledger (the customer can't change it). */
export async function freeRedosUsed(ws: string, adId: string, clipIds: string[]) {
  if (unlimited(ws) || !clipIds.length) return { perAd: 0, perClip: {} as Record<string, number> };
  const rows = await sbRest<{ ref: string }[]>(
    `credits?owner=eq.${encodeURIComponent(ws)}&kind=eq.charge&delta=eq.0&note=eq.${encodeURIComponent(`Rehecho gratis · ${adId}`)}&select=ref&limit=100`,
  ).catch(() => []);
  const perClip: Record<string, number> = {};
  for (const r of rows) perClip[r.ref] = (perClip[r.ref] ?? 0) + 1;
  return { perAd: rows.length, perClip };
}

// ---------- owner tools (panel) ----------

export interface Movement { id: number; delta: number; kind: string; note: string | null; usd: number | null; by_user: string | null; created_at: string }

export async function history(ws: string, limit = 30) {
  return sbRest<Movement[]>(`credits?owner=eq.${encodeURIComponent(ws)}&select=id,delta,kind,note,usd,by_user,created_at&order=id.desc&limit=${limit}`);
}

/** Adds (or takes away) credits by hand. */
export async function grant(ws: string, delta: number, kind: "plan" | "topup" | "adjust", note: string, by: string) {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) throw new CreditError("Cantidad inválida.", 400);
  await sbRest("credits", { method: "POST", body: JSON.stringify({ owner: ws, delta, kind, note: note.slice(0, 200), by_user: by }) });
}

/** Balances of every workspace (for the customer list). */
export async function allBalances(): Promise<Record<string, number>> {
  const rows = await sbRest<{ owner: string; delta: number }[]>("credits?select=owner,delta&limit=100000").catch(() => []);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.owner] = (out[r.owner] ?? 0) + Number(r.delta);
  return out;
}
