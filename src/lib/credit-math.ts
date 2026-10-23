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

// ---------- seconds of video (what customers see) ----------
// Since 23 Oct 2026 customers see CREDITS again (owner), with seconds of video only as a hint. One
// second = what one second of a «Persona IA» ad really costs us (MiniMax H3 Max US$0.08 + sync-3 lips
// US$0.133 + its share of the scene picture and the voice). «Persona real» uses fewer seconds (no video is
// generated), pricier models use more, so a plan's cost to Creads is the same whatever the customer picks.
// Credits stay underneath (charging, refunds, Panel).
export const SECOND_USD = 0.22;

/** Seconds of video a balance of `credits` buys. */
export const secondsOf = (credits: number, usdPerCredit = DEFAULT_USD_PER_CREDIT) =>
  Math.max(0, Math.floor((credits * (usdPerCredit > 0 ? usdPerCredit : DEFAULT_USD_PER_CREDIT)) / SECOND_USD + 1e-9));

/** Seconds a job of `usd` uses (after discount): at least 1. */
export const jobSeconds = (usd: number, usdPerCredit = DEFAULT_USD_PER_CREDIT, discount = 0) => {
  const credits = creditsFor(usd, usdPerCredit, discount);
  if (!credits) return 0;
  return Math.max(1, Math.round((credits * (usdPerCredit > 0 ? usdPerCredit : DEFAULT_USD_PER_CREDIT)) / SECOND_USD));
};

/** «45 s» · «131 s»: always in seconds, never minutes (owner, 23 Oct 2026). */
export const fmtSeconds = (s: number) => `${Math.max(0, Math.round(s)).toLocaleString("es-CL")} s`;

/** How many 30-second ads a number of seconds is (at least 1 when there is any). */
export const adsOf = (s: number) => (s >= 30 ? Math.floor(s / 30) : s > 0 ? 1 : 0);
