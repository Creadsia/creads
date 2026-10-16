"use client";

import { useEffect, useState } from "react";
import { creditsFor, fmtCredits } from "@/lib/credit-math";

// What the signed-in account has and how prices read for it: the owner sees dollars (and credits),
// customers see credits only.

export interface CreditInfo {
  unlimited: boolean;
  owner: boolean;
  balance: number | null;
  rate: number;
  discount: number;
  paidUntil: string | null;
  expired: boolean;
  plan: string | null;
}

let cache: Promise<CreditInfo | null> | null = null;
let cacheAt = 0;
function load(fresh = false) {
  if (!cache || fresh || Date.now() - cacheAt > 30_000) {
    cacheAt = Date.now();
    cache = fetch("/api/credits").then((r) => (r.ok ? r.json() : null)).catch(() => null);
  }
  return cache;
}

/** Ask every screen to reread the balance (after starting a paid job). */
export function refreshCredits() {
  cache = null;
  window.dispatchEvent(new Event("creads-credits"));
}

export function useCredits() {
  const [info, setInfo] = useState<CreditInfo | null>(null);
  useEffect(() => {
    let alive = true;
    const get = (fresh = false) => load(fresh).then((d) => alive && setInfo(d));
    get();
    const on = () => get(true);
    window.addEventListener("creads-credits", on);
    return () => { alive = false; window.removeEventListener("creads-credits", on); };
  }, []);

  /** Price label for a job that costs `usd`. */
  const price = (usd: number) => {
    if (!info) return "…";
    const n = creditsFor(usd, info.rate, info.discount);
    if (info.unlimited) return `US$${usd.toFixed(2).replace(".", ",")} (${fmtCredits(creditsFor(usd, info.rate))} para clientes)`;
    return fmtCredits(n);
  };
  const credits = (usd: number) => (info ? creditsFor(usd, info.rate, info.unlimited ? 0 : info.discount) : 0);
  const covers = (usd: number) => !info || info.unlimited || (info.balance ?? 0) >= credits(usd);
  return { info, price, credits, covers };
}
