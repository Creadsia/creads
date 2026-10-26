// How a new account gets in (no imports: safe for the server, the browser and the tests).
//
// Owner, 26 Oct 2026: every new account adds a card when signing up. Nothing is charged that day, the account
// gets REGALO_CREDITS, and after PRUEBA_DIAS days Mercado Pago charges the PRUEBA_PLAN plan (Testea) every month
// unless the customer cancels first. This replaced the «Pack Prueba US$9» (25–26 Oct 2026), whose machinery stays
// in the code: MODO_PACK=1 in Vercel brings it back (and turns the card trial off). REGALO_CON_TARJETA=0 turns the
// card trial off without the pack (the old free gift by email).

/** «Pack Prueba» (US$9, once) as the way in: off unless MODO_PACK=1. */
export const modoPack = () => process.env.MODO_PACK === "1";
/** Card required at sign-up (the 7-day free trial): on unless the pack is on or REGALO_CON_TARJETA=0. */
export const tarjetaObligatoria = () => !modoPack() && process.env.REGALO_CON_TARJETA !== "0";

/** Gift credits loaded when the card is added (two cuts of up to 8 s, or a first batch of images). */
export const REGALO_CREDITS = 200;
/** Days of free trial before the first charge. */
export const PRUEBA_DIAS = 7;
/** The plan the trial becomes (an id of es.pricing.plans). */
export const PRUEBA_PLAN = "testea" as const;

/**
 * Who has to add the card before using the studio (the full-screen «Último paso» lock). Locked only when the card
 * trial is on and the account is a customer one that never paid (a plan, a top-up, the Pack Prueba or credits added
 * by the owner all count as paid) and never got its gift credits (with the card trial, the gift only loads once the
 * card is accepted; accounts that got the gift before keep using it). The owner's own account («main», unlimited)
 * is never locked.
 */
export function bloqueaPorTarjeta(a: { trialOn: boolean; unlimited: boolean; paid: boolean; giftGiven: boolean }): boolean {
  if (!a.trialOn || a.unlimited) return false;
  return !a.paid && !a.giftGiven;
}
