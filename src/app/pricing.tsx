"use client";

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import { ANNUAL_LABEL, FUNDADOR, PLANS, PRUEBA } from "@/lib/catalog";
import { PRUEBA_DIAS, PRUEBA_PLAN, REGALO_CREDITS } from "@/lib/oferta";
import type { Content } from "@/content/en";
import PayBadges from "./pay-badges";
import { Money, MoneyText } from "./money";
import Garantia from "./garantia";
import { GARANTIA, GARANTIA_EN } from "@/lib/garantia-textos";

/** What every plan includes (owner's plan, 25 Oct 2026). */
const INCLUIDO = {
  es: ["Kit de marca: logo, colores y tono", "Ángulos de venta y hooks gratis", "Cada imagen en feed 4:5, stories 9:16 y cuadrado", "ZIP ordenado por ubicación", "Archivo de importación masiva para Meta", "Biblioteca de hooks por nicho", "Editor que no gasta saldo", "Español e inglés"],
  en: ["Brand kit: logo, colours and tone", "Free sales angles and hooks", "Every image in feed 4:5, stories 9:16 and square", "ZIP sorted by placement", "Meta bulk-import file", "Hooks library by niche", "Editor that doesn't use your balance", "English and Spanish"],
};

// The plans, front and center (owner's plan, 25 Oct 2026): the way in first (the 7-day free trial with card since
// 26 Oct 2026; the Pack Prueba only with MODO_PACK=1), then Testea, Escala (highlighted, with the founder price and
// its real counter) and Agencia, shown as images or videos a month. Every plan button goes straight to checkout
// (/empezar) with that plan already chosen; the trial goes to sign-up (/registro).


export const startHref = (plan: string, yearly = false) => `/empezar?plan=${plan}&periodo=${yearly ? "anual" : "mensual"}`;

export default function Pricing({ t, lang, rate = 950, renews = true, compact = false, pack = false }: { t: Content["pricing"]; lang: string; rate: number; renews?: boolean; /** sales page: no top-ups or payment questions (its own FAQ covers them) */ compact?: boolean; /** the Pack Prueba is the way in (MODO_PACK=1); else the free trial */ pack?: boolean }) {
  const es = lang === "es";
  const [yearly, setYearly] = useState(false);
  const [quedan, setQuedan] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  // prices in US dollars (see ./money); the pesos are said once, at checkout
  const money = (n: number) => <Money usd={n} rate={rate} en={!es} />;
  // plans on sale (older plans are kept for the people who have them, not sold)
  const shown = t.plans.filter((p) => !("hidden" in p && p.hidden));
  const faq = renews ? t.payFaq : t.payFaq.map((f, i) => (i === 2 ? { q: es ? "¿El plan mensual se renueva solo?" : "Does the monthly plan renew by itself?", a: es ? "Por ahora no: pagas un mes a la vez y, si quieres seguir, renuevas desde «Planes» con un clic. No hay cobros automáticos." : "Not for now: you pay one month at a time and renew from \"Plans\" with one click. There are no automatic charges." } : f));

  // Meta "ViewContent": the visitor saw the plans (once per visit)
  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { track("ViewContent", { content_name: "Planes" }); io.disconnect(); } }, { threshold: 0 }); // the block is taller than a phone screen: any part counts
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // the founder places left: a real count from the orders (owner's plan, 25 Oct 2026)
  useEffect(() => { fetch("/api/fundador").then((r) => r.json()).then((d) => setQuedan(typeof d?.quedan === "number" ? d.quedan : null)).catch(() => {}); }, []);

  return (
    <div ref={box} className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label={es ? "Forma de pago" : "Billing"} className="inline-flex w-fit rounded-xl border border-line bg-surface p-1">
          {([[false, t.monthly], [true, t.yearly]] as const).map(([val, label]) => (
            <button key={String(val)} type="button" role="radio" aria-checked={yearly === val} onClick={() => setYearly(val)}
              className={`min-h-11 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${yearly === val ? "bg-ink text-bg" : "text-muted hover:text-ink"}`}>
              {label}{val && <span className="ml-1.5 text-xs text-good">{ANNUAL_LABEL[es ? "es" : "en"]}</span>}
            </button>
          ))}
        </div>
        <p className="text-sm text-muted">{es ? "Un solo saldo al mes: lo gastas en imágenes o videos, como quieras." : "One balance a month: spend it on images or videos, as you like."}</p>
      </div>

      {/* the way in: the 7-day free trial with card (default), or the Pack Prueba («Tu primera tanda») with MODO_PACK=1 */}
      {!pack && <PruebaBox es={es} money={money} />}
      {pack && <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <b className="font-display text-lg font-semibold">{es ? "Tus primeros 10 anuncios" : "Your first batch"} · {money(PRUEBA.usd)} {es ? "pago único" : "one-time"}</b>
          <span className="text-sm text-muted">{es ? "12 imágenes, 4 videos de producto o 1 video con avatar. Si te suscribes dentro de 7 días, se descuenta de tu primer mes." : "12 images, 4 product videos or 1 avatar video. Subscribe within 7 days and it comes off your first month."}</span>
          <span className="text-xs text-muted">{PRUEBA.credits} {es ? "créditos" : "credits"} · {es ? "7 días de garantía" : "7-day guarantee"}</span>
        </div>
        <a href="/registro" className="shrink-0 rounded-xl bg-ink px-5 py-3 text-center font-semibold whitespace-nowrap text-bg">{es ? <>Empezar por {money(PRUEBA.usd)}</> : <>Start for {money(PRUEBA.usd)}</>}</a>
      </div>}

      {/* plans */}
      <div className="mx-auto grid w-full max-w-6xl gap-5 md:grid-cols-3 md:items-start">
        {shown.map((p) => {
          const plan = p as typeof p & { featured?: boolean; imagenes?: number; videos?: number; productos?: number; destaca?: "imagenes" | "productos" };
          const featured = Boolean(plan.featured);
          const founder = !yearly && p.id === FUNDADOR.plan && quedan !== null && quedan > 0;
          const now = yearly ? p.yearly : founder ? FUNDADOR.usd : p.price;
          return (
            <article key={p.id}
              className={`relative flex flex-col overflow-hidden rounded-3xl ${featured
                ? "order-first border-2 border-transparent [background:linear-gradient(var(--surface),var(--surface))_padding-box,var(--grad)_border-box] shadow-[0_40px_100px_-40px_rgba(224,108,200,0.75)] md:order-none"
                : "border border-line bg-surface"}`}>
              {featured && (
                <div className="flex items-center justify-center gap-2 bg-[image:var(--grad)] px-4 py-2 text-sm font-bold text-white">
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden="true"><path d="m10 1.8 2.5 5.1 5.6.8-4 4 1 5.6L10 14.6l-5.1 2.7 1-5.6-4-4 5.6-.8L10 1.8Z" /></svg>
                  {es ? "Plan estrella" : "Most popular"}
                </div>
              )}
              <div className="flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-extrabold">{p.name}</h3>
                  <p className="text-sm text-muted">{p.for}</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  {(yearly || founder) && (
                    <div className="flex flex-wrap items-center gap-2">
                      <s className="text-muted">{money(p.price)}{t.perMonth}</s>
                      <span className="rounded-md bg-rec px-2 py-0.5 text-xs font-bold text-white">{yearly ? ANNUAL_LABEL[es ? "es" : "en"] : es ? "Precio fundador" : "Founder price"}</span>
                    </div>
                  )}
                  <p className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className={`font-display text-[2.4rem] leading-none font-semibold tracking-tight tabular-nums ${featured ? "chroma" : ""}`}>{money(now)}</span>
                    <span className="text-muted">{t.perMonth}</span>
                  </p>
                  <p className="text-sm text-muted">
                    {founder ? (es ? <>Los primeros {FUNDADOR.months} meses, luego {money(p.price)}.{quedan! < FUNDADOR.cupos ? <> Quedan {quedan} de {FUNDADOR.cupos} cupos.</> : <> Solo para los primeros {FUNDADOR.cupos} clientes.</>}</> : <>First {FUNDADOR.months} months, then {money(p.price)}.{quedan! < FUNDADOR.cupos ? <> {quedan} of {FUNDADOR.cupos} places left.</> : <> Only for the first {FUNDADOR.cupos} customers.</>}</>)
                      : yearly ? <>{money((p as typeof p & { yearlyTotal?: number }).yearlyTotal ?? p.yearly * 12)} {es ? "al año" : "a year"}</> : t.billedMonthly} · {t.cancel}
                  </p>
                </div>
                {/* the headline is a result, not credits (owner's plan): «31 videos de producto al mes» */}
                <div className={`flex flex-col gap-1.5 rounded-2xl border p-4 ${featured ? "border-accent/40 bg-accent/[0.07]" : "border-line bg-surface-2"}`}>
                  <b className="font-display text-[1.35rem] leading-tight font-semibold">
                    {plan.destaca === "imagenes"
                      ? (es ? <>{plan.imagenes} imágenes al mes</> : <>{plan.imagenes} images a month</>)
                      : (es ? <>{plan.productos} videos de producto al mes</> : <>{plan.productos} product videos a month</>)}
                  </b>
                  <span className="text-sm text-muted">
                    {plan.destaca === "imagenes"
                      ? (es ? <>o {plan.productos} videos de producto, o {plan.videos} videos con avatar, o la mezcla que quieras</> : <>or {plan.productos} product videos, or {plan.videos} avatar videos, or any mix</>)
                      : (es ? <>o {plan.imagenes} imágenes, o {plan.videos} videos con avatar, o la mezcla que quieras</> : <>or {plan.imagenes} images, or {plan.videos} avatar videos, or any mix</>)}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    {p.credits} {es ? "créditos al mes" : "credits a month"}
                    <details className="relative">
                      <summary className="-m-3.5 grid h-11 w-11 cursor-pointer list-none place-items-center" aria-label={es ? "¿Qué cuenta como anuncio?" : "What counts as an ad?"}><span className="grid h-5 w-5 place-items-center rounded-full border border-line text-[13px] font-bold">?</span></summary>
                      <span className="absolute bottom-6 left-1/2 z-20 w-60 -translate-x-1/2 rounded-lg border border-line bg-surface p-3 text-xs text-ink shadow-xl">
                        <b>{es ? "¿Qué cuenta como anuncio?" : "What counts as an ad?"}</b> {es ? "Cada imagen sale en 3 formatos listos para subir. «Hasta 400 anuncios» corresponde al plan Agencia." : "Every image comes in 3 formats ready to upload. «Up to 400 ads» is the Agency plan."}
                      </span>
                    </details>
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  <a href={startHref(p.id, yearly)}
                    className={`rounded-xl px-5 py-3 text-center text-base font-semibold transition-transform hover:-translate-y-px ${featured ? "bg-[image:var(--grad)] text-white shadow-[0_14px_36px_-12px_rgba(255,43,214,0.75)]" : "bg-ink text-bg"}`}>
                    {t.cta} {p.name}
                  </a>
                  <p className="text-center text-xs text-muted">{(es ? GARANTIA : GARANTIA_EN).boton}</p>
                </div>
                <ul className="flex flex-col gap-2 border-t border-line pt-4 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-good/15 text-good" aria-hidden="true"><svg viewBox="0 0 20 20" className="h-3 w-3"><path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      {/* included in every plan */}
      <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <h3 className="font-bold">{es ? "Incluido en todos los planes" : "Included in every plan"}</h3>
        <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {INCLUIDO[es ? "es" : "en"].map((x) => (
            <li key={x} className="flex items-start gap-2"><span className="mt-0.5 text-good" aria-hidden="true">✓</span>{x}</li>
          ))}
        </ul>
      </div>

      {/* why it's safe to pay */}
      <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        {lang === "es" && !compact && <Garantia pack={pack} />}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PayBadges />
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
      {!compact && <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 sm:p-7">
          <div>
            <h3 className="text-xl font-extrabold">{t.topups.title}</h3>
            <p className="text-[15px] text-muted"><MoneyText text={t.topups.lead} rate={rate} /></p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {t.topups.packs.map(([c, p]) => {
              const credits = Number(c.replace(/\D/g, ""));
              const price = Number(p.replace(/[^\d.]/g, ""));
              return (
                <div key={c} className="flex flex-col gap-2 rounded-2xl bg-surface-2 p-4">
                  <span className="font-semibold">+{Math.floor(credits / 10).toLocaleString("es-CL")} {es ? "imágenes" : "images"}</span>
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
              <p className="mt-2 text-[15px] text-muted"><MoneyText text={f.a} rate={rate} /></p>
            </details>
          ))}
        </div>
      </div>}
    </div>
  );
}

/** «7 días gratis» (owner, 26 Oct 2026): the card today with nothing charged, the gift, then the trial plan. */
function PruebaBox({ es, money }: { es: boolean; money: (n: number) => React.ReactNode }) {
  const plan = PLANS.find((p) => p.id === PRUEBA_PLAN)!;
  const filas: [string, React.ReactNode][] = es
    ? [[`${PRUEBA_DIAS} días`, "Gratis"], ["Créditos de regalo", REGALO_CREDITS], [`Tras ${PRUEBA_DIAS} días · Plan ${plan.name}`, <>{money(plan.monthly)}/mes</>]]
    : [[`${PRUEBA_DIAS} days`, "Free"], ["Gift credits", REGALO_CREDITS], [`After ${PRUEBA_DIAS} days · ${plan.name} plan`, <>{money(plan.monthly)}/mo</>]];
  return (
    <div className="grid gap-4 rounded-3xl border-2 border-transparent p-5 [background:linear-gradient(var(--surface),var(--surface))_padding-box,var(--grad)_border-box] sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
      <div className="flex min-w-0 flex-col gap-2">
        <b className="font-display text-xl font-semibold">{es ? `${PRUEBA_DIAS} días gratis` : `${PRUEBA_DIAS}-day free trial`}</b>
        <span className="text-sm text-muted">
          {es
            ? <>Prueba Creads {PRUEBA_DIAS} días con {REGALO_CREDITS} créditos de regalo para tus primeros anuncios. Si te gusta, sigues con {plan.name} ({plan.credits} créditos al mes); si no, cancelas con un clic.</>
            : <>Try Creads for {PRUEBA_DIAS} days with {REGALO_CREDITS} gift credits for your first batch. If you like it, carry on with {plan.name} ({plan.credits} credits a month); if not, cancel with one click.</>}
        </span>
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          {filas.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-t border-line pt-1.5 sm:flex-col sm:justify-start sm:gap-0.5">
              <dt className="text-muted">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-col items-stretch gap-1.5 sm:items-center">
        <a href="/registro" className="rounded-xl bg-[image:var(--grad)] px-5 py-3 text-center font-semibold whitespace-nowrap text-white shadow-[0_14px_36px_-12px_rgba(255,43,214,0.75)]">{es ? `Probar ${PRUEBA_DIAS} días gratis` : `Try ${PRUEBA_DIAS} days free`}</a>
        <span className="text-center text-xs text-muted">{es ? "Cancelas cuando quieras" : "Cancel anytime"}</span>
      </div>
    </div>
  );
}
