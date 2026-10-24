"use client";

import { newEventId, track } from "@/lib/track";

// One tap from anywhere in the studio to Mercado Pago (owner, 24 Oct 2026: «que siempre te lleve a la compra»):
// creates the order, tells Meta (InitiateCheckout) and opens the payment. If the payment can't open here, the
// plans page with that plan chosen.
export async function buyNow(item: string): Promise<string | null> {
  const eventId = newEventId();
  const r = await fetch("/api/pagos", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item, period: "mensual", method: "mercadopago", eventId }) }).catch(() => null);
  const d = r ? await r.json().catch(() => ({})) : {};
  if (!r?.ok) {
    // an active subscription, a top-up without a plan…: the plans page explains it
    window.location.href = `/app/planes?plan=${encodeURIComponent(item)}`;
    return d.error ?? null;
  }
  track("InitiateCheckout", { value: d.order?.total, currency: "USD", content_name: d.order?.label }, eventId);
  await new Promise((res) => setTimeout(res, 300)); // let the pixel send it
  window.location.href = d.redirect || `/app/planes?recibido=${encodeURIComponent(d.order?.id ?? "")}`;
  return null;
}

/** Opens the upgrade sheet from anywhere (header button, a finished gift ad…). */
export const openUpgrade = () => window.dispatchEvent(new Event("creads:upgrade"));
