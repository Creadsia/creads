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
 * Free helpers that still cost Creadsia money (Claude writing, transcription, voice cloning) are only for
 * accounts with credits: a brand-new signup with 0 credits can't use them. Returns a message, or null.
 */
export async function needsCredits(user: User): Promise<string | null> {
  if (unlimited(user.workspace)) return null;
  try {
    const st = await creditStatus(user.workspace);
    if ((st.balance ?? 0) > 0) return null;
    if (st.paidUntil && !st.expired) return "Te quedaste sin créditos. Suma una recarga en «Planes y créditos» y sigues al tiro.";
  } catch {
    return "No pudimos revisar tus créditos. Intenta de nuevo en un momento.";
  }
  return "Para usar esto necesitas un plan activo. Elige uno en «Planes y créditos» (Starter con 75% de descuento el primer mes).";
}

/**
 * Charges a job before it starts. Throws CreditError (shown to the customer as is) when the plan
 * expired or the credits don't cover it. `ref` ties the charge to the job so a failure can refund it.
 */
export async function chargeJob(user: User, usd: number, note: string, ref: string = randomUUID(), opts: { freeRedoOf?: string } = {}): Promise<Charge> {
  const ws = user.workspace;
  if (unlimited(ws)) return { credits: 0, ref, free: true };
  // A free automatic redo uses the voucher the review granted (if there is one left); otherwise it's paid.
  if (opts.freeRedoOf) {
    const id = await sbRpc<number | null>("use_free_redo", { p_owner: ws, p_ad: opts.freeRedoOf, p_clip: ref }).catch(() => null);
    if (id) return { credits: 0, ref, free: true };
    // asked for free but there's no voucher left: don't charge behind the customer's back
    throw new CreditError("Este corte ya usó su rehecho gratis. Si quieres rehacerlo otra vez, usa «Rehacer este corte» (gasta créditos).", 409);
  }
  try {
    const [rate, b] = await Promise.all([usdPerCredit(), billingOf(ws)]);
    if (expired(b)) throw new CreditError("Tu plan venció. Renuévalo en «Planes y créditos» y sigues al tiro.");
    const credits = creditsFor(usd, rate, b.discount);
    const rows = await sbRpc<{ ok: boolean; balance: number }[]>("spend_credits", {
      p_owner: ws, p_amount: credits, p_note: note.slice(0, 200), p_ref: ref, p_usd: +usd.toFixed(4), p_by: user.email, p_free: false,
    });
    const r = rows[0];
    if (!r?.ok) {
      throw new CreditError(`Te faltan créditos: esto usa ${credits.toLocaleString("es-CL")} y te quedan ${Number(r?.balance ?? 0).toLocaleString("es-CL")}. ${Number(r?.balance ?? 0) <= 0 && !b.plan ? "Elige un plan en «Planes y créditos» (Starter con 75% de descuento el primer mes)." : "Suma créditos en «Planes y créditos»."}`);
    }
    return { credits, ref, free: false };
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

/** The review found a severe error in a clip: grant one free redo (max 1 per clip, 2 per ad). */
export async function grantFreeRedo(ws: string, adId: string, clipId: string) {
  if (unlimited(ws)) return true;
  return Boolean(await sbRpc<boolean>("grant_free_redo", { p_owner: ws, p_ad: adId, p_clip: clipId }).catch(() => false));
}

/** True if this clip has a granted free redo that hasn't been used (a failed one counts as unused). */
export async function freeRedoAvailable(ws: string, adId: string, clipId: string) {
  if (unlimited(ws)) return true;
  try {
    const voucher = await sbRest<{ id: number }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&kind=eq.adjust&ref=eq.${encodeURIComponent(`voucher:${adId}:${clipId}`)}&select=id&limit=1`);
    if (!voucher.length) return false;
    const used = await sbRest<{ id: number }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&kind=eq.charge&delta=eq.0&ref=eq.${encodeURIComponent(clipId)}&note=eq.${encodeURIComponent(`Rehecho gratis · ${adId}`)}&select=id`);
    if (!used.length) return true;
    const refunds = await sbRest<{ ref: string }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&kind=eq.refund&ref=in.(${used.map((u) => `charge:${u.id}`).join(",")})&select=ref`);
    return refunds.length >= used.length;
  } catch {
    return false;
  }
}

/** True if a charge for `ref` made since `since` (ISO time) hasn't been refunded yet. */
export async function chargedSince(ws: string, ref: string, since: string) {
  if (unlimited(ws)) return false;
  const rows = await sbRest<{ id: number }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&kind=eq.charge&ref=eq.${encodeURIComponent(ref)}&created_at=gte.${encodeURIComponent(since)}&delta=lte.0&select=id`); // a free redo is a 0 charge (its refund gives the voucher back)
  if (!rows.length) return false;
  const back = await sbRest<{ ref: string }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&kind=eq.refund&ref=in.(${rows.map((r) => `charge:${r.id}`).join(",")})&select=ref`);
  return back.length < rows.length;
}

// ---------- owner tools (panel) ----------

export interface Movement { id: number; delta: number; kind: string; note: string | null; usd: number | null; by_user: string | null; created_at: string }

export async function history(ws: string, limit = 30) {
  // free-redo vouchers (0 credits, bookkeeping only) are left out
  return sbRest<Movement[]>(`credits?owner=eq.${encodeURIComponent(ws)}&or=(kind.neq.adjust,delta.neq.0)&select=id,delta,kind,note,usd,by_user,created_at&order=id.desc&limit=${limit}`);
}

/** Adds (or takes away) credits by hand. */
export class AlreadyDone extends Error {}

/** Adds (or takes away) credits. With `ref` "mp:<payment>", the same payment can only count once. */
export async function grant(ws: string, delta: number, kind: "plan" | "topup" | "adjust", note: string, by: string, ref?: string) {
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1_000_000) throw new CreditError("Cantidad inválida.", 400);
  try {
    await sbRest("credits", { method: "POST", body: JSON.stringify({ owner: ws, delta, kind, note: note.slice(0, 200), by_user: by, ...(ref ? { ref } : {}) }) });
  } catch (err) {
    if (ref && err instanceof SbError && err.status === 409) throw new AlreadyDone(ref);
    throw err;
  }
}

/** Balances of every workspace (for the customer list). */
export async function allBalances(): Promise<Record<string, number>> {
  const rows = await sbRest<{ owner: string; delta: number }[]>("credits?select=owner,delta&limit=100000").catch(() => []);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.owner] = (out[r.owner] ?? 0) + Number(r.delta);
  return out;
}

/**
 * Of these jobs (charged with ref = job id), which ones got their credits back. A failed job that was
 * never charged (no credits, daily limit…) isn't in the set: nothing to give back.
 */
export async function refundedJobs(ws: string, jobIds: string[]): Promise<Set<string>> {
  const ids = jobIds.filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  if (unlimited(ws) || !ids.length) return new Set();
  const owner = encodeURIComponent(ws);
  const charges = await sbRest<{ id: number; ref: string }[]>(`credits?owner=eq.${owner}&kind=eq.charge&delta=lt.0&ref=in.(${ids.join(",")})&select=id,ref&limit=200`);
  if (!charges.length) return new Set();
  const refunds = await sbRest<{ ref: string }[]>(`credits?owner=eq.${owner}&kind=eq.refund&ref=in.(${charges.map((c) => `charge:${c.id}`).join(",")})&select=ref&limit=200`);
  const back = new Set(refunds.map((r) => r.ref));
  return new Set(charges.filter((c) => back.has(`charge:${c.id}`)).map((c) => c.ref));
}
