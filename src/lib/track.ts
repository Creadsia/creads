"use client";

// Browser side of Meta tracking. Events only fire after the visitor accepted cookies; each one gets
// an id that the server repeats in its own copy, so Meta counts it once.

type Fbq = (...args: unknown[]) => void;
declare global { interface Window { fbq?: Fbq } }

export const hasConsent = () => {
  try { return document.cookie.split(/;\s*/).includes("creads_consent=1"); } catch { return false; }
};

export const newEventId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `ev-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/** Fires a standard Meta event in the browser (no-op without consent or pixel). Returns its id. */
export function track(name: string, data: Record<string, unknown> = {}, eventId = newEventId()) {
  try {
    if (hasConsent() && window.fbq) window.fbq("track", name, data, { eventID: eventId });
  } catch { /* measurement never breaks the page */ }
  return eventId;
}
