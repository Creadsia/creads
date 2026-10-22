// RedTrack (ad tracking, owner 22 Oct 2026): the visitor's RedTrack click id travels with the signup and the
// order, and each step is reported to RedTrack as a server-to-server postback (no API key needed). Same events
// as Meta: CompleteRegistration, Lead, InitiateCheckout, Purchase (with the amount in US$).
//   NEXT_PUBLIC_REDTRACK_SCRIPT = the src of the universal script (RedTrack → Tools → Scripts)
//   REDTRACK_DOMAIN             = the tracking domain (e.g. trk.creadsia.com), for the postbacks
// Both are public values, not secrets. Without them nothing is sent.

import { usdClpRate } from "./usd-clp";

export const RTK_COOKIE = "rtkclickid-store";
const ID = /^[A-Za-z0-9_-]{10,64}$/;

/** The click id from the cookies RedTrack's script (or our page, from ?rtkcid=) left. */
export function rtkFrom(cookies: Record<string, string>): string | undefined {
  const v = cookies[RTK_COOKIE] || cookies.creads_rtk;
  return v && ID.test(v) ? v : undefined;
}

export function postbackUrl(domain: string, clickid: string, type: string, sumUsd?: number) {
  const q = new URLSearchParams({ clickid, type });
  if (sumUsd && sumUsd > 0) q.set("sum", (Math.round(sumUsd * 100) / 100).toString());
  return `https://${domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}/postback?${q}`;
}

/** Reports one conversion to RedTrack. Never throws; returns whether it went out. */
export async function sendRedtrack(type: string, clickid: string | undefined, value?: number, currency = "USD"): Promise<boolean> {
  const domain = process.env.REDTRACK_DOMAIN;
  if (!domain || !clickid || !ID.test(clickid)) return false;
  try {
    let usd = value;
    if (value && currency === "CLP") usd = value / (await usdClpRate().catch(() => 950));
    const res = await fetch(postbackUrl(domain, clickid, type, usd), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) console.error("redtrack postback", type, res.status);
    return res.ok;
  } catch (e) {
    console.error("redtrack postback", type, e instanceof Error ? e.message : e);
    return false;
  }
}
