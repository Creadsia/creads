import Image from "next/image";
import type { Content } from "@/content/en";
import { SHOWN_PLANS, usd } from "@/lib/catalog";
import { Logo } from "./brand";
import Pricing from "./pricing";
import LoopVideo from "./loop-video";
import ThemeToggle from "./theme-toggle";
import FunnelNudges from "./funnel-nudges";
import WhatsAppButton from "./whatsapp";
import { SCENES, VIDEOS, ScriptMock, SpyMock, poster } from "./landing";

// The home page for people who arrive from an ad (owner and Benjamín, 21 Oct 2026: back to simple). One job:
// explain in plain words what Creads does for a business owner — spy, script, voice, video, edit, images — and
// get them to pick one of the two plans. The broad landing (every model and studio) stays in landing.tsx
// for the English site.

const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";
const wrap = "mx-auto w-full max-w-6xl";

// the checkout link (pricing.tsx is a client module: its helper can't run here)
const startHref = (plan: string) => `/empezar?plan=${plan}&periodo=mensual`;

const emprende = SHOWN_PLANS.find((p) => p.id === "starter")!;
const negocio = SHOWN_PLANS.find((p) => p.id === "plus")!;

const STEPS = [
  {
    k: "espiar",
    title: "Espía lo que ya vende",
    text: "Busca los anuncios de tu rubro que llevan 30 días o más activos en Facebook e Instagram. Si alguien sigue pagando por mostrarlos, es porque le venden.",
  },
  {
    k: "guion",
    title: "Tu guion de venta",
    text: "Creads desarma el anuncio ganador y te escribe 3 guiones para tu negocio, con 10 ganchos para los primeros segundos.",
  },
  {
    k: "voz",
    title: "La voz, con tu acento",
    text: "Elige una voz chilena, argentina, colombiana, venezolana o mexicana, o la tuya. Escuchas cada frase antes de hacer el video.",
  },
  {
    k: "video",
    title: "El video, escena por escena",
    text: "Una persona habla a cámara en el lugar que pidas: en su casa, en un mall, en el auto. Puede ser una persona creada con IA o tu propia persona grabada.",
  },
  {
    k: "edicion",
    title: "Editado y listo",
    text: "Cortes, subtítulos y el estilo de tu marca. Lo descargas en vertical para Reels, TikTok y Stories, y lo subes a tu campaña.",
  },
] as const;

const FAQ = [
  ["¿Necesito saber de inteligencia artificial o de edición?", "No. Escribes en tus palabras qué vendes y a quién. Creads escribe el guion, arma las escenas, pone la voz y edita. Tú apruebas cada paso."],
  ["¿Se ve real?", "Puedes elegir entre una persona creada con IA (en la escena que pidas) o tu propia persona: subes un video tuyo, o de alguien que te dio permiso, y Creads le pone la voz y los labios en cada anuncio. Antes de entregarlo, Creads revisa cada corte y te marca lo que conviene rehacer."],
  ["¿En qué idioma y con qué acento?", "En español con acento chileno, argentino, colombiano, venezolano o mexicano, o en inglés. También puedes usar tu propia voz."],
  ["¿Espiar anuncios y escribir guiones descuenta segundos?", "No. Espiar a la competencia y crear guiones vienen incluidos en tu plan. Los segundos se usan solo al hacer los videos y las imágenes."],
  ["¿Qué pasa si un video falla?", "Si la IA no entrega el video, los segundos vuelven solos a tu saldo, sin que tengas que pedirlo."],
  ["¿Cómo pago?", "Con tarjeta de crédito, débito o saldo de Mercado Pago, en pesos chilenos al cambio del día. Creads nunca ve tu tarjeta y el comprobante te llega al correo."],
  ["¿Puedo cancelar?", "Sí, cuando quieras, desde tu cuenta y con un clic. Sigues usando tu plan hasta la fecha que pagaste."],
] as const;

function Check() {
  return <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-good" aria-hidden="true"><path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** What the voice step looks like: the accents and one take being checked. */
function VoiceMock() {
  return (
    <div className="flex h-full flex-col gap-2 rounded-xl border border-line bg-surface p-3 text-[11px]">
      <div className="flex flex-wrap gap-1">
        {["Chilena", "Argentina", "Colombiana", "Mexicana"].map((a, i) => (
          <span key={a} className={`rounded-full px-2 py-0.5 font-semibold ${i === 0 ? "bg-accent/15 text-accent-text" : "bg-surface-2 text-muted"}`}>{a}</span>
        ))}
      </div>
      {["Corte 1", "Corte 2"].map((c) => (
        <div key={c} className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2 py-1.5">
          <b className="w-12 shrink-0">{c}</b>
          <span aria-hidden="true" className="flex h-4 flex-1 items-center gap-[2px]">
            {[4, 9, 6, 12, 7, 14, 5, 10, 8, 13, 6, 9, 4, 11, 7].map((h, i) => <span key={i} className="w-[3px] rounded-full bg-ink/40" style={{ height: `${h + 2}px` }} />)}
          </span>
          <span className="shrink-0 font-semibold text-good">✓ dice el guion</span>
        </div>
      ))}
    </div>
  );
}

export default function Venta({ t, rate = 950, renews = true }: { t: Content; rate?: number; renews?: boolean }) {
  const art = (k: (typeof STEPS)[number]["k"]) => {
    if (k === "espiar") return <SpyMock m={t.flow.mock} />;
    if (k === "guion") return <ScriptMock m={t.flow.mock} />;
    if (k === "voz") return <VoiceMock />;
    if (k === "video") return (
      <figure className="relative h-full overflow-hidden rounded-xl bg-surface-2">
        <LoopVideo src={VIDEOS.valpo!} poster={poster(SCENES.valpo.src)} className="absolute inset-0 h-full w-full object-cover" />
        <figcaption className="absolute inset-x-2 bottom-2 rounded-lg bg-black/65 px-2 py-1 text-center text-[11px] font-semibold text-white">Escena: en la calle, de día</figcaption>
      </figure>
    );
    return (
      <figure className="relative h-full overflow-hidden rounded-xl bg-surface-2">
        <Image src={SCENES.ugc.src} alt="" fill sizes="260px" className="object-cover" />
        <figcaption className="absolute inset-x-3 bottom-6 text-center font-display text-[15px] leading-tight font-semibold text-white [text-shadow:0_2px_6px_rgba(0,0,0,0.9)]">Esto te ahorra <span className="text-[#FFD400]">un día</span> de grabación</figcaption>
      </figure>
    );
  };

  return (
    <div className="overflow-x-clip pb-20 lg:pb-0">
      <FunnelNudges t={t.nudge} lang={t.lang} rate={rate} />
      <WhatsAppButton />

      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-line/60 bg-bg/85 backdrop-blur">
        <div className={`${wrap} flex items-center justify-between gap-3 py-3 ${gutter}`}>
          <Logo href="/" />
          <nav aria-label="Secciones" className="hidden items-center gap-1 text-[15px] md:flex">
            <a href="#como" className="rounded-lg px-3 py-2 text-muted hover:bg-surface hover:text-ink">Cómo funciona</a>
            <a href="#recibes" className="rounded-lg px-3 py-2 text-muted hover:bg-surface hover:text-ink">Qué recibes</a>
            <a href="#pricing" className="rounded-lg px-3 py-2 text-muted hover:bg-surface hover:text-ink">Planes</a>
            <a href="#preguntas" className="rounded-lg px-3 py-2 text-muted hover:bg-surface hover:text-ink">Preguntas</a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden min-[420px]:contents"><ThemeToggle lang="es" /></span>
            <a href="/app" className="px-2 text-sm font-semibold text-muted hover:text-ink">Entrar</a>
            <a href="#pricing" className="whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-bg hover:opacity-90 sm:px-4">Ver planes</a>
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-14 pb-16 sm:gap-16">
        {/* 1 · Hero: the promise, the price, and the ad itself on a phone */}
        <section className={`stage relative -mt-px overflow-hidden ${gutter}`}>
          <div className={`${wrap} relative grid items-center gap-8 py-10 sm:py-12 lg:grid-cols-[1.2fr_0.8fr]`}>
            <div className="flex min-w-0 flex-col gap-5">
              <p className="w-fit rounded-full border border-line bg-surface/70 px-3 py-1 text-sm font-semibold">Para dueños de negocio que venden con anuncios</p>
              <h1 className="font-display text-[2.2rem] leading-[1.05] font-semibold sm:text-[3.4rem]">
                Tus anuncios en video e imágenes, <span className="chroma">listos para vender.</span>
              </h1>
              <p className="max-w-[54ch] text-lg text-muted">
                Espías lo que le funciona a tu competencia, Creads escribe tu guion y te entrega el anuncio con voz latina y subtítulos, más imágenes para tu marca. Sin grabar, sin editar, sin agencia.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <a href={startHref("starter")} className="flex flex-col items-center rounded-xl bg-[image:var(--grad)] px-6 py-3 text-center font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)] transition-transform hover:-translate-y-px">
                  <span className="text-[17px]">Empieza hoy</span>
                  <span className="text-xs font-normal text-white/85">desde {usd(emprende.monthly)} al mes · sin permanencia</span>
                </a>
                <a href="#como" className="rounded-xl border border-line bg-surface/60 px-5 py-3 text-center font-semibold backdrop-blur hover:bg-surface">Mira cómo funciona</a>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
                {["Voces con acento latino", "Listo para Meta y TikTok", "Cancelas cuando quieras"].map((x) => <li key={x} className="flex items-center gap-1.5"><Check />{x}</li>)}
              </ul>
            </div>
            <div className="relative mx-auto w-full max-w-[210px] sm:max-w-[290px]">
              <div className="relative aspect-[9/16] overflow-hidden rounded-[2rem] border-[6px] border-ink/90 bg-black shadow-[0_40px_90px_-30px_rgba(138,92,255,0.55)]">
                <LoopVideo src={VIDEOS.coach!} poster={poster(SCENES.coach.src)} className="absolute inset-0 h-full w-full object-cover" />
                <p className="absolute inset-x-4 bottom-14 text-center font-display text-base leading-tight font-semibold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]">Así se ve tu anuncio <span className="text-[#FFD400]">terminado</span></p>
              </div>
              <div className="absolute -left-10 top-8 hidden w-28 overflow-hidden rounded-2xl border border-line bg-surface shadow-xl sm:block">
                <div className="relative aspect-[4/5]"><Image src={SCENES.serum.src} alt="Imagen 4:5 para el feed hecha con IA" fill sizes="120px" className="object-cover" /></div>
                <p className="px-2 py-1 text-[10px] font-semibold">+ imágenes 4:5</p>
              </div>
            </div>
          </div>
        </section>

        {/* 2 · How it works: the five steps, in order */}
        <section id="como" className={`scroll-mt-20 ${gutter}`} aria-labelledby="como-title">
          <div className={`${wrap} flex flex-col gap-5`}>
            <div className="flex flex-col gap-1.5">
              <h2 id="como-title" className="text-[1.8rem] leading-tight font-extrabold sm:text-[2.2rem]">Cómo funciona, en 5 pasos</h2>
              <p className="text-muted">Todo dentro de Creads. En cada paso ves el resultado y decides si sigues.</p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((st, i) => (
                <li key={st.k} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
                  {/* phones: just the numbered steps, so the page stays short */}
                  <div className="hidden h-40 overflow-hidden sm:block">{art(st.k)}</div>
                  <span className="flex items-center gap-2"><b className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs text-bg">{i + 1}</b><b className="leading-tight">{st.title}</b></span>
                  <p className="text-sm text-muted">{st.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 3 · What you get every month, and who appears in the ad */}
        <section id="recibes" className={`scroll-mt-20 ${gutter}`} aria-labelledby="recibes-title">
          <div className={`${wrap} flex flex-col gap-5`}>
            <div className="flex flex-col gap-1.5">
              <h2 id="recibes-title" className="text-[1.8rem] leading-tight font-extrabold sm:text-[2.2rem]">Qué recibes cada mes</h2>
              <p className="text-muted">Un anuncio se cansa en semanas: siempre tienes versiones nuevas para probar cuál vende más.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["4 a 10", "anuncios en video de 30 s", "Verticales, con voz, subtítulos y tu estilo."],
                ["20 a 50", "imágenes para anuncios", "4:5 para el feed, con tu producto o tu avatar."],
                ["Incluido", "espiar y crear guiones", "No descuenta segundos de tu plan."],
              ].map(([n, k, d]) => (
                <div key={k} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
                  <span className="shrink-0 font-display text-3xl font-semibold">{n}</span>
                  <span className="flex flex-col"><b className="leading-tight">{k}</b><span className="text-sm text-muted">{d}</span></span>
                </div>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { title: "Persona IA", tag: "Sin grabar", text: "Una persona creada con IA, siempre la misma cara, en el lugar que pidas: tu local, una casa, un mall, el auto.", img: SCENES.realtor.src },
                { title: "Tu persona real", tag: "Lo más real", text: "Subes una vez un video de 30 a 60 s hablando al celular. Creads le pone la voz nueva en los labios en cada anuncio.", img: SCENES.car.src },
              ].map((x) => (
                <article key={x.title} className="grid grid-cols-[84px_1fr] items-center gap-4 rounded-2xl border border-line bg-surface p-3">
                  <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-surface-2"><Image src={x.img} alt="" fill sizes="90px" className="object-cover" /></div>
                  <div className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-extrabold">{x.title}</h3><span className="rounded-full bg-accent/12 px-2 py-0.5 text-xs font-bold text-accent-text">{x.tag}</span></span>
                    <p className="text-sm text-muted">{x.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 4 · The two plans */}
        <section id="pricing" className={`scroll-mt-20 ${gutter}`} aria-labelledby="pricing-title">
          <div className={`${wrap} flex flex-col gap-5`}>
            <div className="flex flex-col gap-1.5">
              <h2 id="pricing-title" className="text-[1.8rem] leading-tight font-extrabold sm:text-[2.2rem]">Planes</h2>
              <p className="text-muted">{emprende.name} {usd(emprende.monthly)} al mes · {negocio.name} {usd(negocio.monthly)} al mes · Sin permanencia: cancelas cuando quieras.</p>
            </div>
            <Pricing t={t.pricing} lang="es" rate={rate} renews={renews} compact />
          </div>
        </section>

        {/* 5 · Questions before paying */}
        <section id="preguntas" className={`scroll-mt-20 ${gutter}`} aria-labelledby="faq-title">
          <div className={`${wrap} grid gap-5 lg:grid-cols-[0.7fr_1.3fr]`}>
            <h2 id="faq-title" className="text-[1.8rem] leading-tight font-extrabold sm:text-[2.2rem]">Preguntas</h2>
            <div className="flex flex-col divide-y divide-line border-y border-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{q}<span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-45">+</span></summary>
                  <p className="pt-2 text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 6 · Last call */}
        <section className={gutter}>
          <div className={`${wrap} relative flex flex-col items-center gap-4 overflow-hidden rounded-[2rem] border border-line bg-surface px-6 py-10 text-center`}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-25 blur-[90px]" style={{ background: "var(--grad)" }} />
            <h2 className="relative max-w-3xl text-[1.8rem] leading-tight font-black sm:text-4xl">Tu próximo anuncio puede estar listo hoy.</h2>
            <a href={startHref("starter")} className="relative rounded-xl bg-[image:var(--grad)] px-7 py-3 font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)]">Empezar con {emprende.name} · {usd(emprende.monthly)} al mes</a>
          </div>
        </section>
      </main>

      <footer className={`border-t border-line ${gutter}`}>
        <div className={`${wrap} flex flex-col gap-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between`}>
          <span>© {new Date().getFullYear()} Creads IA · hola@creadsia.com</span>
          <span className="flex flex-wrap gap-4">
            <a href="/terminos" className="hover:text-ink">Términos y condiciones</a>
            <a href="/privacidad" className="hover:text-ink">Política de privacidad</a>
            <a href="/en" className="hover:text-ink">English</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
