import { type Service, ensureDailyCap, ensureFunds, explainFailure } from "./balances";
import { type User, isOwner } from "./auth";
import { CreditError, chargeJob, refundJob, usdPerCredit } from "./credits";
import { sbRest, readPrivateJSON } from "./supabase";
import { DEFAULT_FINANZAS, type Finanzas } from "./finance";

// One door for every paid job: charge the customer's credits, then make sure Creads can pay the
// provider today (daily limit, provider balance). If anything says no, the credits go back.

export async function payFor(user: User, usd: number, note: string, svc: Service, opts: { ref?: string; freeRedoOf?: string; chars?: number } = {}) {
  // a job with no real price (NaN, 0, negative) is never started: it would run for free
  if (!Number.isFinite(usd) || usd <= 0) throw new CreditError("No pudimos calcular el precio de este trabajo. Revisa los datos e intenta de nuevo.", 400);
  if (user.workspace !== "main" && !opts.freeRedoOf) await ensureNewAccountLimit(user.workspace, usd);
  const charge = await chargeJob(user, usd, note, opts.ref, { freeRedoOf: opts.freeRedoOf });
  try {
    if (user.workspace !== "main") await ensureDailyCap(usd); // the owner sees the alert but is never blocked
    await ensureFunds(svc, usd, opts.chars ?? 0);
  } catch (err) {
    await refundJob(user.workspace, charge.ref, "Devuelto: el servicio no estaba disponible");
    throw err;
  }
  return charge;
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
    const credits = Math.floor(cap / (await usdPerCredit()));
    throw new CreditError(`Por seguridad, durante sus primeros 2 días las cuentas nuevas pueden usar hasta ${credits.toLocaleString("es-CL")} créditos por día. Mañana tienes más; si lo necesitas hoy, escríbenos a hola@creadsia.com y lo habilitamos al tiro.`, 429);
  } catch (err) {
    if (err instanceof CreditError) throw err;
    console.error("new account limit", ws, err instanceof Error ? err.message : err); // never block on a read error
  }
}
