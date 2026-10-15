"use client";

import { useRef, useState } from "react";
import type { Content } from "@/content/en";
import WaitlistForm from "./waitlist-form";

export default function Pricing({ t, form, lang }: { t: Content["pricing"]; form: Content["form"]; lang: string }) {
  const [yearly, setYearly] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const formBox = useRef<HTMLDivElement>(null);

  function reserve(id: string) {
    setPlan(id);
    requestAnimationFrame(() => formBox.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }

  const chosen = t.plans.find((p) => p.id === plan);

  return (
    <div className="flex flex-col gap-8">
      {/* billing switch */}
      <div className="flex flex-wrap items-center gap-3">
        <div role="radiogroup" aria-label="Billing" className="inline-flex rounded-xl border border-line bg-surface p-1">
          {[
            [false, t.monthly],
            [true, t.yearly],
          ].map(([val, label]) => (
            <button
              key={String(val)}
              type="button"
              role="radio"
              aria-checked={yearly === val}
              onClick={() => setYearly(val as boolean)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                yearly === val ? "bg-ink text-bg" : "text-muted hover:text-ink"
              }`}
            >
              {label as string}
            </button>
          ))}
        </div>
        <span className="rounded-full bg-good/15 px-3 py-1 text-sm font-semibold text-good">{t.yearlyBadge}</span>
      </div>

      {/* plans */}
      <div className="grid gap-4 lg:grid-cols-3">
        {t.plans.map((p) => {
          const featured = p.id === "plus";
          const price = yearly ? p.yearly : p.price;
          return (
            <article
              key={p.id}
              className={`relative flex flex-col gap-5 rounded-3xl p-6 sm:p-7 ${
                featured
                  ? "border-2 border-transparent bg-surface [background:linear-gradient(var(--surface),var(--surface))_padding-box,var(--grad)_border-box] shadow-[0_30px_90px_-40px_rgba(224,108,200,0.6)]"
                  : "border border-line bg-surface"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-extrabold">{p.name}</h3>
                {featured && (
                  <span className="rounded-full bg-[image:var(--grad)] px-3 py-1 text-xs font-bold text-white">
                    {t.popular}
                  </span>
                )}
              </div>
              <p className="text-[15px] text-muted">{p.for}</p>
              <div className="flex flex-col gap-1">
                <p className="flex items-baseline gap-1">
                  <span className="font-display text-5xl font-black [font-stretch:110%]">US${price}</span>
                  <span className="text-muted">{t.perMonth}</span>
                </p>
                <p className="text-sm text-muted">
                  {yearly ? `US$${p.yearly * 12} ${t.billedYearly}` : t.launch}
                </p>
              </div>
              <p className="rounded-xl bg-surface-2 px-4 py-3">
                <b className="font-display text-xl font-extrabold">{p.credits}</b>{" "}
                <span className="text-muted">{t.credits}</span>
              </p>
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
              <button
                type="button"
                onClick={() => reserve(p.id)}
                aria-pressed={plan === p.id}
                className={`mt-auto rounded-xl px-5 py-3 font-semibold transition-transform hover:-translate-y-px ${
                  featured ? "bg-[image:var(--grad)] text-white" : "bg-ink text-bg"
                }`}
              >
                {t.reserve} {p.name}
              </button>
            </article>
          );
        })}
      </div>

      {/* reservation form for the chosen plan */}
      <div ref={formBox} className={plan ? "" : "hidden"}>
        {chosen && (
          <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 sm:p-7 lg:flex-row lg:items-center lg:gap-10">
            <div className="flex flex-col gap-1 lg:w-80">
              <p className="text-sm text-muted">{form.planLabel}</p>
              <p className="text-2xl font-extrabold">
                {chosen.name} · US${yearly ? chosen.yearly : chosen.price}
                {t.perMonth}
              </p>
              <p className="text-sm text-muted">{t.reserveNote}</p>
            </div>
            <div className="min-w-0 flex-1">
              <WaitlistForm key={chosen.id} id={`plan-${chosen.id}`} t={form} lang={lang} plan={`${chosen.id}${yearly ? "-yearly" : ""}`} />
            </div>
          </div>
        )}
      </div>

      {/* top-ups and promos */}
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 sm:p-7">
          <div>
            <h3 className="text-xl font-extrabold">{t.topups.title}</h3>
            <p className="text-[15px] text-muted">{t.topups.lead}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {t.topups.packs.map(([c, p]) => (
              <div key={c} className="flex flex-col gap-1 rounded-2xl bg-surface-2 p-4">
                <span className="font-semibold">{c}</span>
                <span className="font-display text-2xl font-extrabold">{p}</span>
              </div>
            ))}
          </div>
        </div>
        <ul className="flex flex-col gap-3">
          {t.promos.map(([title, text]) => (
            <li key={title} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
              <span aria-hidden="true" className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-rec" />
              <span>
                <b className="font-semibold">{title}.</b> <span className="text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
