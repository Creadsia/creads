"use client";

import { Fragment, useEffect, useState } from "react";
import { usd as usdLabel } from "@/lib/catalog";

// Prices (owner, 25 Oct 2026): only in US dollars, everywhere on the site. The pesos Mercado Pago charges are
// said once, next to the payment (checkout), not on the page. useUsdClp stays for that checkout note.

let cached: number | null = null;
let pending: Promise<number> | null = null;
function loadRate() {
  pending ??= fetch("/api/dolar").then((r) => r.json()).then((d) => (cached = Number(d?.usdClp) > 0 ? Number(d.usdClp) : 950)).catch(() => (cached = 950));
  return pending;
}

/** The dollar rate used for the pesos (the server's when a page passes it, else read once). */
export function useUsdClp(given?: number) {
  const [rate, setRate] = useState<number | null>(given ?? cached);
  useEffect(() => {
    if (given) return;
    if (cached) setRate(cached);
    else loadRate().then(setRate);
  }, [given]);
  return given ?? rate;
}

export const clpLabel = (n: number) => `$${n.toLocaleString("es-CL")}`;

/** One price, in dollars: «US$29». (`rate` is accepted for older callers and ignored.) */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Money({ usd, rate, en = false }: { usd: number; rate?: number; en?: boolean }) {
  return <>{en ? `US$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : usdLabel(usd)}</>;
}

/** A sentence with «US$…» amounts in it (copy written in dollars): each amount follows the visitor's money. */
export function MoneyText({ text, rate }: { text: string; rate?: number }) {
  const parts = text.split(/(US\$[\d.]+(?:,\d{1,2})?)/);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{p}</Fragment>;
        const n = Number(p.slice(3).replace(/\./g, "").replace(",", "."));
        return Number.isFinite(n) && n > 0 ? <Money key={i} usd={n} rate={rate} /> : <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

/** Kept for older callers: the site is in dollars for everyone now. */
export const OnlyCL = ({}: { children: React.ReactNode }) => null;
export const OnlyUSD = ({ children }: { children: React.ReactNode }) => <>{children}</>;
