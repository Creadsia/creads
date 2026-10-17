"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import { LAUNCH_PCT, usd } from "@/lib/catalog";
import type { Content } from "@/content/en";
import PayBadges from "./pay-badges";

// The plans, front and center: the launch price is the big number, the regular price is crossed out,
// and every button goes straight to checkout (/empezar) with that plan already chosen.

const dollarsEn = (n: number) => `US$${n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export const startHref = (plan: string, yearly = false) => `/empezar?plan=${plan}&periodo=${yearly ? "anual" : "mensual"}`;

function Yes({ es }: { es: boolean }) {
  return (
    <span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-good/15 text-good" role="img" aria-label={es ? "Incluido" : "Included"}>
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
        <path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Cell({ v, es }: { v: string; es: boolean }) {
  if (v === "yes") return <Yes es={es} />;
  if (v === "no") return <span className="text-muted/60" aria-label={es ? "No incluido" : "Not included"}>—</span>;
  return <span className="font-medium tabular-nums">{v}</span>;
}

/** The comparison: plans as columns with price and button on top, features grouped below.
 *  On phones one plan at a time (a table with four columns doesn't fit). */
function ComparePlans({ t, es, yearly, money, perMonthOfYear }: { t: Content["pricing"]; es: boolean; yearly: boolean; money: (n: number) => string; perMonthOfYear: (n: number) => string }) {
  const [pick, setPick] = useState(1); // phones: Plus first
  const plans = t.plans;
  const price = (p: (typeof plans)[number]) => (yearly ? perMonthOfYear(p.yearly * 12) : money(p.price * (1 - LAUNCH_PCT / 100)));
  const note = (p: (typeof plans)[number]) => (yearly ? (es ? "al mes, facturado anual" : "per month, billed yearly") : `${t.firstMonth} · ${t.then} ${money(p.price)}`);
  const hi = (i: number) => (i === 1 ? "bg-accent/[0.06]" : "");

  return (
    <section aria-labelledby="compare-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 id="compare-title" className="text-xl font-extrabold">{t.compare.title}</h3>
        <p className="text-[15px] text-muted">{t.compare.lead}</p>
      </div>

      {/* computers and tablets */}
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
        <table className="w-full table-fixed border-collapse text-left text-[15px]">
          <colgroup><col className="w-[34%]" /><col /><col /><col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className="p-5 align-bottom text-sm font-normal text-muted">{es ? "Precios en US$" : "Prices in US$"}</th>
              {plans.map((p, i) => (
                <th key={p.id} scope="col" className={`relative p-5 align-top font-normal ${hi(i)}`}>
                  {i === 1 && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-[image:var(--grad)]" />}
                  <div className="flex flex-col gap-3">
                    <span className="flex items-center gap-2">
                      <b className="text-lg">{p.name}</b>
                      {i === 1 && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent-text">{t.popular}</span>}
                    </span>
                    <span className="flex flex-col">
                      <span className="font-display text-[1.9rem] leading-none font-semibold tabular-nums">{price(p)}</span>
                      <span className="mt-1 text-xs text-muted">{note(p)}</span>
                    </span>
                    <a href={startHref(p.id, yearly)}
                      className={`rounded-lg px-3 py-2 text-center text-sm font-semibold transition-colors ${i === 1 ? "bg-[image:var(--grad)] text-white" : "border border-line hover:border-muted"}`}>
                      {t.cta} {p.name}
                    </a>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          {t.compare.groups.map((g) => (
            <tbody key={g.title}>
              <tr>
                <th scope="colgroup" colSpan={4} className="border-t border-line bg-surface-2/60 px-5 py-2.5 text-[13px] font-semibold text-muted">{g.title}</th>
              </tr>
              {g.rows.map(([row, ...vals]) => (
                <tr key={row} className="border-t border-line/70 transition-colors hover:bg-surface-2/40">
                  <th scope="row" className="px-5 py-3.5 font-normal">{row}</th>
                  {vals.map((v, i) => (
                    <td key={i} className={`px-5 py-3.5 text-center ${hi(i)}`}><Cell v={v} es={es} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {/* phones: one plan at a time */}
      <div className="flex flex-col gap-3 md:hidden">
        <div role="tablist" aria-label={t.compare.title} className="grid grid-cols-3 rounded-xl border border-line bg-surface p-1">
          {plans.map((p, i) => (
            <button key={p.id} type="button" role="tab" aria-selected={pick === i} onClick={() => setPick(i)}
              className={`rounded-lg py-2 text-sm font-semibold transition-colors ${pick === i ? "bg-ink text-bg" : "text-muted"}`}>{p.name}</button>
          ))}
        </div>
        <div role="tabpanel" className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex flex-col gap-3 p-4">
            <span className="flex flex-col">
              <span className="font-display text-[1.8rem] leading-none font-semibold tabular-nums">{price(plans[pick])}</span>
              <span className="mt-1 text-xs text-muted">{note(plans[pick])}</span>
            </span>
            <a href={startHref(plans[pick].id, yearly)} className={`rounded-lg px-4 py-2.5 text-center text-sm font-semibold ${pick === 1 ? "bg-[image:var(--grad)] text-white" : "bg-ink text-bg"}`}>{t.cta} {plans[pick].name}</a>
          </div>
          {t.compare.groups.map((g) => (
            <dl key={g.title}>
              <dt className="border-t border-line bg-surface-2/60 px-4 py-2 text-[13px] font-semibold text-muted">{g.title}</dt>
              {g.rows.map(([row, ...vals]) => (
                <dd key={row} className="flex items-center justify-between gap-4 border-t border-line/70 px-4 py-3 text-[15px]">
                  <span>{row}</span>
                  <span className="shrink-0 text-right"><Cell v={vals[pick]} es={es} /></span>
                </dd>
              ))}
            </dl>
          ))}
        </div>
      </div>
    </section>
  );
}

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
                    <p className="text-sm text-muted">{money(p.yearly * 12)} {t.yearlyTotal}</p>
                  </>
                ) : (
                  <>
                    <p className="flex flex-wrap items-baseline gap-x-2">
                      <s className="text-lg text-muted">{money(p.price)}</s>
                      <span className="font-display text-[2.6rem] leading-none font-semibold">{money(first)}</span>
                      <span className="text-muted">{t.firstMonth}</span>
                    </p>
                    <p className="text-sm text-muted">{t.then} {money(p.price)}{t.perMonth}</p>
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
      <ComparePlans t={t} es={es} yearly={yearly} money={money} perMonthOfYear={perMonthOfYear} />

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
