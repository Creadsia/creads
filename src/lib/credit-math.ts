// How many credits a job costs. Shared by the server (charging) and the studio (showing prices),
// so customers always see exactly what they'll be charged.

/**
 * Free automatic redos of finished cuts/videos when the quality review finds a severe error. Off (owner, 19 Oct
 * 2026): they cost a second generation. The review still runs, shows what's wrong and the customer redoes a cut
 * with one click (paid). Technical failures still give the credits back (the provider doesn't charge them).
 */
export const FREE_REDOS = false;

/** US$ of model cost covered by one credit (Panel interno → Planes: "Costo por crédito"). */
export const DEFAULT_USD_PER_CREDIT = 0.0193;

/** Credits for a job that costs `usd`, after the customer's discount (%). At least 1. */
export function creditsFor(usd: number, usdPerCredit = DEFAULT_USD_PER_CREDIT, discount = 0) {
  if (!(usd > 0)) return 0;
  const rate = usdPerCredit > 0 ? usdPerCredit : DEFAULT_USD_PER_CREDIT;
  const d = Math.min(100, Math.max(0, discount));
  if (d >= 100) return 0; // full discount: free
  return Math.max(1, Math.ceil((usd / rate) * (1 - d / 100) - 1e-9));
}

export const fmtCredits = (n: number) => `${n.toLocaleString("es-CL")} crédito${n === 1 ? "" : "s"}`;
