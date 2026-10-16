import { type Service, ensureDailyCap, ensureFunds, explainFailure } from "./balances";
import { type User, isOwner } from "./auth";
import { CreditError, chargeJob, refundJob } from "./credits";

// One door for every paid job: charge the customer's credits, then make sure Creads can pay the
// provider today (daily limit, provider balance). If anything says no, the credits go back.

export async function payFor(user: User, usd: number, note: string, svc: Service, opts: { ref?: string; free?: boolean; chars?: number } = {}) {
  const charge = await chargeJob(user, usd, note, opts.ref, { free: opts.free });
  try {
    await ensureDailyCap(usd);
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
