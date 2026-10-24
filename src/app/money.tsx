"use client";

import { Fragment, useEffect, useState } from "react";
import { clpFor, usd as usdLabel } from "@/lib/catalog";

// Prices in the visitor's money (owner, 24 Oct 2026): pesos for people in Chile, US$ for everyone else.
// Both amounts are rendered and CSS shows one: <html data-cl> is set before the first paint from the
// «creads_pais» cookie (src/middleware.ts), so static pages stay cached and nothing flickers. The pesos
// use the same rate and rounding Mercado Pago charges (clpFor + /api/dolar).

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

/** One price: «US$25» abroad, «$23.990» in Chile. `en` writes the dollars the English way. */
export function Money({ usd, rate, en = false }: { usd: number; rate?: number; en?: boolean }) {
  const r = useUsdClp(rate);
  const dollars = en ? `US$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : usdLabel(usd);
  return (
    <>
      <span className="p-usd">{dollars}</span>
      <span className="p-clp">{r ? clpLabel(clpFor(usd, r)) : dollars}</span>
    </>
  );
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

/** Shown only in Chile / only outside Chile. */
export const OnlyCL = ({ children }: { children: React.ReactNode }) => <span className="p-clp">{children}</span>;
export const OnlyUSD = ({ children }: { children: React.ReactNode }) => <span className="p-usd">{children}</span>;
