import { SECOND_USD, fmtSeconds } from "./credit-math";
import { type Service, ensureDailyCap, ensureFunds, explainFailure } from "./balances";
import { type User, isOwner } from "./auth";
import { CreditError, chargeJob, refundJob, usdPerCredit } from "./credits";
import { sbRest, readPrivateJSON } from "./supabase";
import { DEFAULT_FINANZAS, type Finanzas } from "./finance";

// One door for every paid job: charge the customer's credits, then make sure Creads can pay the
// provider today (daily limit, provider balance). If anything says no, the credits go back.

/** `usd` sets the credits charged; `opts.cost` is what the provider really costs (limits and balances), when different. */
export async function payFor(user: User, usd: number, note: string, svc: Service, opts: { ref?: string; freeRedoOf?: string; chars?: number; cost?: number } = {}) {
  // a job with no real price (NaN, 0, negative) is never started: it would run for free
  if (!Number.isFinite(usd) || usd <= 0) throw new CreditError("No pudimos calcular el precio de este trabajo. Revisa los datos e intenta de nuevo.", 400);
  const cost = opts.cost && opts.cost > 0 ? opts.cost : usd;
  if (user.workspace !== "main" && !opts.freeRedoOf) await ensureNewAccountLimit(user.workspace, cost);
  const charge = await chargeJob(user, usd, note, opts.ref, { freeRedoOf: opts.freeRedoOf });
  try {
    // the owner's own browser is never blocked; a key of the owner's team is (a leaked key can't drain the providers)
    if (user.workspace !== "main" || user.viaKey) await ensureDailyCap(cost);
    await ensureFunds(svc, cost, opts.chars ?? 0);
  } catch (err) {
    await refundJob(user.workspace, charge.ref, "Devuelto: el servicio no estaba disponible");
    throw err;
  }
  later(() => lowBalanceCheck(user));
  // activation: the account's first paid job (once)
  if (user.workspace !== "main" && !charge.free) later(async () => {
    const { once } = await import("./marketing");
    if (await once(`evento:primera:${user.workspace}`, 3650 * 86400)) {
      const { registrarEvento } = await import("./eventos");
      await registrarEvento("primera_generacion", { cuenta: user.workspace, correo: user.email, que: note.slice(0, 80) });
    }
  });
  return charge;
}

/** After the response: run `fn` without slowing the customer down (Next's after(), or in the background). */
function later(fn: () => Promise<void>) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { after } = require("next/server") as typeof import("next/server");
    after(() => fn().catch(() => {}));
  } catch {
    void fn().catch(() => {});
  }
}

/** Less than one ad left (≈ 25 s) on an active plan: one heads-up per plan period. */
async function lowBalanceCheck(user: User) {
  if (user.workspace === "main" || user.viaKey) return;
  const { creditStatus } = await import("./credits");
  const st = await creditStatus(user.workspace);
  if (st.unlimited || st.expired || st.balance == null) return;
  const { secondsOf } = await import("./credit-math");
  const secs = secondsOf(st.balance, st.rate);
  if (secs >= 25) return;
  const { once } = await import("./marketing");
  if (!(await once(`saldo-bajo:${user.workspace}:${st.paidUntil ?? "sin-plan"}`, 40 * 86400))) return;
  const [{ lowBalanceEmail }, { sendEmail }] = await Promise.all([import("./emails"), import("./providers/email")]);
  await sendEmail(lowBalanceEmail(user.email, user.name ?? null, { seconds: secs, credits: st.balance, until: st.paidUntil ?? null }));
  await (await import("./eventos")).registrarEvento("saldo_bajo", { cuenta: user.workspace, correo: user.email, creditos: st.balance });
}

/** The message a failed job shows: credit problems as they are, provider problems explained. */
export async function failMessage(err: unknown, user: User, svc?: Service) {
  if (err instanceof CreditError) return err.message;
  return explainFailure(err instanceof Error ? err : new Error("No se pudo completar."), isOwner(user), svc);
}

export const failStatus = (err: unknown) => (err instanceof CreditError ? err.status : 502);

// Anti-fraud: a stolen card can buy a plan and burn every credit in AI before the bank reverses the
// payment. During its first 48 hours an account can spend up to a daily amount (Panel → Planes:
// "Límite cuentas nuevas", 0 = off). Writing #sinlimite in the customer's notes lifts it.
const NEW_HOURS = 48;
const wsCache = new Map<string, { at: number; created: number; free: boolean }>();

async function accountAge(ws: string) {
  const hit = wsCache.get(ws);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit;
  const rows = await sbRest<{ created_at: string; notes: string | null }[]>(`workspaces?id=eq.${encodeURIComponent(ws)}&select=created_at,notes&limit=1`);
  const v = { at: Date.now(), created: Date.parse(rows[0]?.created_at ?? "") || 0, free: /#sinlimite/i.test(rows[0]?.notes ?? "") };
  wsCache.set(ws, v);
  return v;
}

export async function ensureNewAccountLimit(ws: string, usd: number) {
  try {
    const a = await accountAge(ws);
    if (a.free || !a.created || Date.now() - a.created > NEW_HOURS * 3600_000) return;
    const book = await readPrivateJSON<Finanzas>("finanzas.json").catch(() => null);
    const cap = Number(book?.config?.limiteNuevas ?? DEFAULT_FINANZAS.config.limiteNuevas);
    if (!(cap > 0)) return;
    const day = new Date().toISOString().slice(0, 10);
    const [charges, refunds] = await Promise.all([
      sbRest<{ id: number; usd: number | null }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&kind=eq.charge&created_at=gte.${day}&select=id,usd&limit=1000`),
      sbRest<{ ref: string | null }[]>(`credits?owner=eq.${encodeURIComponent(ws)}&kind=eq.refund&created_at=gte.${day}&select=ref&limit=1000`),
    ]);
    const back = new Set(refunds.map((r) => r.ref));
    const spent = charges.filter((c) => !back.has(`charge:${c.id}`)).reduce((s, r) => s + Number(r.usd ?? 0), 0); // failed jobs that were refunded don't count
    if (spent + usd <= cap) return;
    throw new CreditError(`Por seguridad, durante sus primeros 2 días las cuentas nuevas pueden usar hasta ${fmtSeconds(Math.floor(cap / SECOND_USD))} de video por día. Mañana tienes más; si lo necesitas hoy, escríbenos a hola@creadsia.com y lo habilitamos al tiro.`, 429);
  } catch (err) {
    if (err instanceof CreditError) throw err;
    console.error("new account limit", ws, err instanceof Error ? err.message : err); // never block on a read error
  }
}
