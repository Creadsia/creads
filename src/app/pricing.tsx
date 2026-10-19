"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import { LAUNCH_PCT, LAUNCH_PRICE, hasLaunch, usd } from "@/lib/catalog";
import type { Content } from "@/content/en";
import PayBadges from "./pay-badges";

// The plans, front and center: the launch price is the big number, the regular price is crossed out,
// and every button goes straight to checkout (/empezar) with that plan already chosen.

const dollarsEn = (n: number) => `US$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const startHref = (plan: string, yearly = false) => `/empezar?plan=${plan}&periodo=${yearly ? "anual" : "mensual"}`;

export default function Pricing({ t, lang, renews = true }: { t: Content["pricing"]; lang: string; rate: number; renews?: boolean }) {
  const es = lang === "es";
  const [yearly, setYearly] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  // money as the visitor reads it: pesos in Spanish (that's what Mercado Pago charges), dollars in English
  const dollars = (n: number) => (es ? usd(n) : dollarsEn(n)); // prices are always in US$ (decimal comma in Spanish)
  const money = dollars;
  // a yearly plan per month = the yearly total ÷ 12 (so 12 × the monthly figure is what they pay)
  const perMonthOfYear = (usdYear: number) => dollars(Math.round((usdYear / 12) * 100) / 100);
  // without automatic renewal (temporary payment setup) the FAQ must not promise it
  const faq = renews ? t.payFaq : t.payFaq.map((f, i) => (i === 2 ? { q: es ? "¿El plan mensual se renueva solo?" : "Does the monthly plan renew by itself?", a: es ? "Por ahora no: pagas un mes a la vez y, si quieres seguir, renuevas desde «Planes y créditos» con un clic. No hay cobros automáticos." : "Not for now: you pay one month at a time and renew from \"Plans and credits\" with one click. There are no automatic charges." } : f));

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

      {/* plans: three cards, everything about each plan from top to bottom, built to pick one and pay */}
      <div className="grid gap-5 lg:grid-cols-3 lg:items-start">
        {t.plans.map((p) => {
          const featured = p.id === "plus";
          const credits = Number(String(p.credits).replace(/\D/g, ""));
          const ads = Math.max(1, Math.floor(credits / 300));
          const promo = !yearly && hasLaunch(p.id);
          const monthNow = yearly ? (p.yearly * 12) / 12 : promo ? LAUNCH_PRICE : p.price;
          const perAd = Math.round((monthNow / ads) * 100) / 100;
          return (
            <article key={p.id}
              className={`relative flex flex-col overflow-hidden rounded-3xl ${featured
                ? "order-first border-2 border-transparent [background:linear-gradient(var(--surface),var(--surface))_padding-box,var(--grad)_border-box] shadow-[0_40px_100px_-40px_rgba(224,108,200,0.75)] lg:order-none lg:-mt-5"
                : "border border-line bg-surface"}`}>
              {featured && (
                <div className="flex items-center justify-center gap-2 bg-[image:var(--grad)] px-4 py-2 text-sm font-bold text-white">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="m10 1.8 2.5 5.1 5.6.8-4 4 1 5.6L10 14.6l-5.1 2.7 1-5.6-4-4 5.6-.8L10 1.8Z" /></svg>
                  {t.popular} · {t.bestValue}
                </div>
              )}

              <div className="flex flex-col gap-5 p-6 sm:p-7">
                <div className="flex flex-col gap-1">
                  <h3 className="text-2xl font-extrabold">{p.name}</h3>
                  <p className="text-[15px] text-muted">{p.for}</p>
                </div>

                {/* price */}
                <div className="flex flex-col gap-1.5">
                  {(yearly || promo) && (
                    <div className="flex flex-wrap items-center gap-2">
                      <s className="text-muted">{money(p.price)}{t.perMonth}</s>
                      <span className="rounded-md bg-rec px-2 py-0.5 text-xs font-bold text-white">{yearly ? t.yearlyBadge : `−${LAUNCH_PCT}% ${t.firstMonth}`}</span>
                    </div>
                  )}
                  <p className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className={`font-display text-[3rem] leading-none font-semibold tracking-tight tabular-nums ${featured ? "chroma" : ""}`}>{yearly ? perMonthOfYear(p.yearly * 12) : money(monthNow)}</span>
                    <span className="text-muted">{yearly || !promo ? t.perMonth : ` ${t.firstMonth}`}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {yearly ? `${money(p.yearly * 12)} ${t.yearlyTotal}` : promo ? `${t.then} ${money(p.price)}${t.perMonth}` : t.billedMonthly} · {t.cancel}
                  </p>
                </div>

                {/* what the money turns into */}
                <div className={`grid grid-cols-2 overflow-hidden rounded-2xl border ${featured ? "border-accent/40 bg-accent/[0.07]" : "border-line bg-surface-2"}`}>
                  <div className="flex flex-col gap-0.5 p-3.5">
                    <b className="font-display text-2xl font-semibold tabular-nums">{p.credits}</b>
                    <span className="text-xs text-muted">{t.credits}</span>
                  </div>
                  <div className="flex flex-col gap-0.5 border-l border-line p-3.5">
                    <b className="font-display text-2xl font-semibold tabular-nums">≈ {ads}</b>
                    <span className="text-xs text-muted">{t.adsMonth}</span>
                  </div>
                  <div className="col-span-2 border-t border-line px-3.5 py-2 text-sm">
                    <b className="tabular-nums">≈ {money(perAd)}</b> <span className="text-muted">{t.perAd}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <a href={startHref(p.id, yearly)}
                    className={`rounded-xl px-5 py-4 text-center text-[17px] font-semibold transition-transform hover:-translate-y-px ${featured ? "bg-[image:var(--grad)] text-white shadow-[0_14px_36px_-12px_rgba(255,43,214,0.75)]" : "bg-ink text-bg"}`}>
                    {t.cta} {p.name}
                  </a>
                  <p className="text-center text-xs text-muted">{t.cardNote}</p>
                </div>
              </div>

              {/* everything it includes */}
              <div className="flex flex-col gap-5 border-t border-line px-6 py-6 sm:px-7">
                <b className="text-sm">{t.includes}</b>
                {t.compare.groups.map((g) => (
                  <div key={g.title} className="flex flex-col gap-2.5">
                    <span className="text-xs font-semibold text-muted">{g.title}</span>
                    <ul className="flex flex-col gap-2.5 text-[15px]">
                      {g.rows.map(([row, ...vals]) => {
                        const v = vals[t.plans.indexOf(p)];
                        const off = v === "no";
                        return (
                          <li key={row} className={`flex items-center justify-between gap-3 ${off ? "text-muted/60" : ""}`}>
                            <span className="flex items-center gap-2.5">
                              {off
                                ? <span className="grid h-5 w-5 shrink-0 place-items-center text-muted/50" aria-hidden="true">—</span>
                                : <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-good/15 text-good" aria-hidden="true"><svg viewBox="0 0 20 20" className="h-3 w-3"><path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
                              <span>{row}{off ? <span className="sr-only"> ({es ? "no incluido" : "not included"})</span> : null}</span>
                            </span>
                            {v !== "yes" && !off && <b className="shrink-0 text-right font-semibold tabular-nums">{v}</b>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
                <a href={startHref(p.id, yearly)} className={`mt-1 text-center text-sm font-semibold ${featured ? "text-accent-text" : "text-ink"} hover:underline`}>
                  {t.cta} {p.name} →
                </a>
              </div>
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
                  <a href={`/app/planes?plan=pack-${credits}`} className="mt-auto rounded-lg border border-line bg-surface px-3 py-2 text-center text-sm font-semibold hover:border-accent-text">{t.topups.buy}</a>
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
