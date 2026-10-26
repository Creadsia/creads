"use client";

// Browser side of Meta tracking. Events only fire after the visitor accepted cookies; each one gets
// an id that the server repeats in its own copy, so Meta counts it once.

type Fbq = (...args: unknown[]) => void;
declare global { interface Window { fbq?: Fbq; __creadsQ?: unknown[][] } }

export const hasConsent = () => {
  try { return document.cookie.split(/;\s*/).includes("creads_consent=1"); } catch { return false; }
};

export const newEventId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `ev-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/**
 * StartTrial, once per page load, with the SAME event_id the server uses for CAPI (`trial-<order>`), so Meta
 * de-dupes the pixel and the Conversions API copy. value 0, currency USD, predicted_ltv = the chosen plan's price.
 */
let trialSent = false;
export function startTrial(order?: string, usd?: number) {
  if (trialSent || !order) return;
  trialSent = true;
  track("StartTrial", { value: 0, currency: "USD", ...(usd ? { predicted_ltv: usd } : {}) }, `trial-${order}`);
}

/** Fires a standard Meta event in the browser (no-op without consent or pixel). Returns its id. */
export function track(name: string, data: Record<string, unknown> = {}, eventId = newEventId()) {
  try {
    if (!hasConsent()) return eventId;
    if (window.fbq) window.fbq("track", name, data, { eventID: eventId });
    else (window.__creadsQ ??= []).push(["track", name, data, { eventID: eventId }]); // sent when the pixel loads
  } catch { /* measurement never breaks the page */ }
  return eventId;
}
