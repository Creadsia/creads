"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import { LAUNCH_PCT, clpFor } from "@/lib/catalog";
import type { Content } from "@/content/en";
import PayBadges from "./pay-badges";

// The plans, front and center: the launch price is the big number, the regular price is crossed out,
// and every button goes straight to checkout (/empezar) with that plan already chosen.

const pesos = (n: number) => `$${n.toLocaleString("es-CL")}`;
const dollars = (n: number) => `US$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const startHref = (plan: string, yearly = false) => `/empezar?plan=${plan}&periodo=${yearly ? "anual" : "mensual"}`;

function Yes() {
  return (
    <svg viewBox="0 0 20 20" className="mx-auto h-5 w-5 text-good" role="img" aria-label="✓">
      <path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Pricing({ t, lang, rate, renews = true }: { t: Content["pricing"]; lang: string; rate: number; renews?: boolean }) {
  const es = lang === "es";
  const [yearly, setYearly] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // money as the visitor reads it: pesos in Spanish (that's what Mercado Pago charges), dollars in English
  const money = (usd: number) => dollars(usd); // prices are always in US$
  // a yearly plan per month = the yearly total ÷ 12 (so 12 × the monthly figure is what they pay)
  const perMonthOfYear = (usdYear: number) => dollars(Math.round((usdYear / 12) * 100) / 100);
  // without automatic renewal (temporary payment setup) the FAQ must not promise it
  const faq = renews ? t.payFaq : t.payFaq.map((f, i) => (i === 2 ? { q: es ? "¿El plan mensual se renueva solo?" : "Does the monthly plan renew by itself?", a: es ? "Por ahora no: pagas un mes a la vez y, si quieres seguir, renuevas desde «Planes y créditos» con un clic. No hay cobros automáticos." : "Not for now: you pay one month at a time and renew from \"Plans and credits\" with one click. There are no automatic charges." } : f));
  const other = (usd: number) => `≈ ${pesos(clpFor(usd, rate))} CLP`;

  // Meta "ViewContent": the visitor saw the plans (once per visit)
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { track("ViewContent", { content_name: "Planes" }); io.disconnect(); } }, { threshold: 0 }); // the block is taller than a phone screen: any part counts
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={box} className="flex flex-col gap-8">
      {/* the offer, impossible to miss */}
      <div className="stage relative flex flex-col gap-4 overflow-hidden rounded-3xl border border-line bg-black p-5 text-white sm:flex-row sm:items-center sm:gap-8 sm:p-7">
        <span aria-hidden="true" className="pointer-events-none absolute -top-24 -left-10 h-64 w-64 rounded-full opacity-50 blur-[80px]" style={{ background: "var(--grad)" }} />
        <span className="chroma relative font-display text-6xl leading-none font-semibold sm:text-7xl">−{LAUNCH_PCT}%</span>
        <span className="relative flex min-w-0 flex-1 flex-col gap-1">
          <span className="w-fit rounded-md bg-rec px-2 py-0.5 text-xs font-bold">{t.offerTag}</span>
          <b className="text-xl leading-snug sm:text-2xl">{t.offer}</b>
          <span className="text-sm text-white/70">{t.offerNote}</span>
        </span>
        <div role="radiogroup" aria-label={es ? "Forma de pago" : "Billing"} className="relative inline-flex w-fit shrink-0 rounded-xl border border-white/20 bg-white/5 p-1">
          {([[false, t.monthly], [true, t.yearly]] as const).map(([val, label]) => (
            <button key={String(val)} type="button" role="radio" aria-checked={yearly === val} onClick={() => setYearly(val)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${yearly === val ? "bg-white text-black" : "text-white/70 hover:text-white"}`}>
              {label}{val && <span className="ml-1.5 text-xs text-good">{t.yearlyBadge}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* plans */}
      <div className="grid gap-4 lg:grid-cols-3 lg:items-stretch">
        {t.plans.map((p) => {
          const featured = p.id === "plus";
          const credits = Number(String(p.credits).replace(/\D/g, ""));
          const first = p.price * (1 - LAUNCH_PCT / 100);
          return (
            <article key={p.id}
              className={`relative flex flex-col gap-5 rounded-3xl p-6 sm:p-7 ${featured
                ? "border-2 border-transparent bg-surface [background:linear-gradient(var(--surface),var(--surface))_padding-box,var(--grad)_border-box] shadow-[0_30px_90px_-40px_rgba(224,108,200,0.6)] lg:-my-3 lg:py-9"
                : "border border-line bg-surface"}`}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-extrabold">{p.name}</h3>
                {featured && <span className="rounded-full bg-[image:var(--grad)] px-3 py-1 text-xs font-bold text-white">{t.popular}</span>}
              </div>
              <p className="text-[15px] text-muted">{p.for}</p>

              <div className="flex flex-col gap-1">
                {yearly ? (
                  <>
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <s className="text-lg text-muted">{money(p.price)}</s>
                      <span className="font-display text-[2.6rem] leading-none font-semibold">{perMonthOfYear(p.yearly * 12)}</span>
                      <span className="text-muted">{t.perMonth}</span>
                    </p>
                    <p className="text-sm text-muted">{money(p.yearly * 12)} {t.yearlyTotal} · {other(p.yearly * 12)}</p>
                  </>
                ) : (
                  <>
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <s className="text-lg text-muted">{money(p.price)}</s>
                      <span className="font-display text-[2.6rem] leading-none font-semibold">{money(first)}</span>
                      <span className="text-muted">{t.firstMonth}</span>
                    </p>
                    <p className="text-sm text-muted">{t.then} {money(p.price)}{t.perMonth} · {other(first)}</p>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-0.5 rounded-xl bg-surface-2 px-4 py-3">
                <span><b className="font-display text-xl font-semibold">{p.credits}</b> <span className="text-muted">{t.credits}</span></span>
                <span className="text-sm text-muted">≈ {Math.floor(credits / 300)} {t.adsMonth}</span>
              </div>

              <a href={startHref(p.id, yearly)}
                className={`flex flex-col items-center rounded-xl px-5 py-3.5 text-center font-semibold transition-transform hover:-translate-y-px ${featured ? "bg-[image:var(--grad)] text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)]" : "bg-ink text-bg"}`}>
                <span className="text-[17px]">{t.cta} {p.name}</span>
                <span className={`text-xs font-normal ${featured ? "text-white/85" : "opacity-70"}`}>{t.ctaNote}</span>
              </a>

              <ul className="flex flex-col gap-2.5 text-[15px]">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5">
                    <svg viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-good" aria-hidden="true">
                      <path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      {/* why it's safe to pay */}
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PayBadges />
          <span className="text-sm text-muted">{t.clpNote}</span>
        </div>
        <dl className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.trust.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-1">
              <dt className="font-semibold">{k}</dt>
              <dd className="text-sm text-muted">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* plan comparison */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xl font-extrabold">{t.compare.title}</h3>
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[620px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-line">
                {t.compare.cols.map((c, i) => (
                  <th key={c || "x"} scope="col" className={`p-4 ${i ? "w-[19%] text-center" : ""} ${i === 2 ? "bg-surface-2" : ""}`}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.compare.rows.map(([row, ...vals]) => (
                <tr key={row} className="border-b border-line last:border-0">
                  <th scope="row" className="p-4 font-medium">{row}</th>
                  {vals.map((v, i) => (
                    <td key={i} className={`p-4 text-center ${i === 1 ? "bg-surface-2 font-semibold" : ""}`}>
                      {v === "yes" ? <Yes /> : v === "no" ? <span className="text-muted" aria-label={es ? "No incluido" : "Not included"}>—</span> : v}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-4" />
                {t.plans.map((p) => (
                  <td key={p.id} className={`p-3 text-center ${p.id === "plus" ? "bg-surface-2" : ""}`}>
                    <a href={startHref(p.id, yearly)} className={`inline-block rounded-lg px-3 py-2 text-sm font-semibold ${p.id === "plus" ? "bg-[image:var(--grad)] text-white" : "border border-line hover:bg-surface-2"}`}>
                      {t.cta} {p.name}
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* top-ups and payment questions */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 sm:p-7">
          <div>
            <h3 className="text-xl font-extrabold">{t.topups.title}</h3>
            <p className="text-[15px] text-muted">{t.topups.lead}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {t.topups.packs.map(([c, p]) => {
              const credits = Number(c.replace(/\D/g, ""));
              const price = Number(p.replace(/[^\d.]/g, ""));
              return (
                <div key={c} className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4">
                  <span className="font-semibold">{c}</span>
                  <span className="font-display text-2xl font-semibold">{money(price)}</span>
                  <a href={`/empezar?plan=pack-${credits}`} className="mt-auto rounded-lg border border-line bg-surface px-3 py-2 text-center text-sm font-semibold hover:border-accent-text">{t.topups.buy}</a>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col divide-y divide-line rounded-3xl border border-line bg-surface px-6">
          {faq.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {f.q}
                <span aria-hidden="true" className="text-xl leading-none text-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-[15px] text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
