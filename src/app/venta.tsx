import Image from "next/image";
import type { Content } from "@/content/en";
import { LAUNCH_PRICE, SHOWN_PLANS, usd } from "@/lib/catalog";
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
  const first = usd(LAUNCH_PRICE);
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

      <main className="flex flex-col gap-24 pb-24">
        {/* Hero: the promise in one sentence, the price, and the ad itself on a phone */}
        <section className={`stage relative -mt-px overflow-hidden ${gutter}`}>
          <div className={`${wrap} relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.15fr_0.85fr]`}>
            <div className="flex min-w-0 flex-col gap-6">
              <p className="w-fit rounded-full border border-line bg-surface/70 px-3 py-1 text-sm font-semibold">Para dueños de negocio que quieren vender más con anuncios</p>
              <h1 className="font-display text-[2.4rem] leading-[1.04] font-semibold sm:text-6xl">
                Tus anuncios en video e imágenes, <span className="chroma">listos para vender.</span>
              </h1>
              <p className="max-w-[56ch] text-lg text-muted">
                Creads IA espía lo que le funciona a tu competencia, escribe tu guion de venta y te entrega anuncios con voz latina, subtítulos e imágenes para tu marca. Sin grabar, sin editar y sin agencia. Tú apruebas y publicas.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
                <a href={startHref("starter")} className="flex flex-col items-center rounded-xl bg-[image:var(--grad)] px-6 py-3.5 text-center font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)] transition-transform hover:-translate-y-px">
                  <span className="text-[17px]">Empieza hoy por {first}</span>
                  <span className="text-xs font-normal text-white/85">el primer mes · luego {usd(emprende.monthly)}</span>
                </a>
                <a href="#como" className="rounded-xl border border-line bg-surface/60 px-5 py-3.5 text-center font-semibold backdrop-blur hover:bg-surface">Mira cómo funciona</a>
              </div>
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted">
                {["Voces con acento latino", "Listo para Meta y TikTok", "Cancelas cuando quieras"].map((x) => <li key={x} className="flex items-center gap-1.5"><Check />{x}</li>)}
              </ul>
            </div>
            <div className="relative mx-auto w-full max-w-[340px]">
              <div className="relative aspect-[9/16] overflow-hidden rounded-[2.2rem] border-[6px] border-ink/90 bg-black shadow-[0_40px_90px_-30px_rgba(138,92,255,0.55)]">
                <LoopVideo src={VIDEOS.coach!} poster={poster(SCENES.coach.src)} className="absolute inset-0 h-full w-full object-cover" />
                <p className="absolute inset-x-5 bottom-14 text-center font-display text-base leading-tight font-semibold text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.9)]">Así se ve tu anuncio <span className="text-[#FFD400]">terminado</span></p>
              </div>
              <div className="absolute -left-6 top-10 hidden w-36 overflow-hidden rounded-2xl border border-line bg-surface shadow-xl sm:block">
                <div className="relative aspect-[4/5]"><Image src={SCENES.serum.src} alt="Imagen 4:5 para el feed hecha con IA" fill sizes="150px" className="object-cover" /></div>
                <p className="px-2 py-1.5 text-[11px] font-semibold">+ imágenes 4:5 para el feed</p>
              </div>
              <ul className="absolute -right-6 top-1/3 hidden flex-col gap-1.5 text-[12px] font-semibold sm:flex">
                {["Voz chilena", "Subtítulos", "Revisado"].map((x) => <li key={x} className="flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 shadow-md"><Check />{x}</li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* Before / after: what the owner stops doing */}
        <section className={gutter} aria-labelledby="antes-title">
          <div className={`${wrap} grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center`}>
            <h2 id="antes-title" className="text-[2rem] leading-tight font-extrabold sm:text-[2.6rem]">Lo que hoy te toma un día, o una agencia, en unos minutos.</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
                <b className="text-muted">Sin Creads</b>
                <ul className="flex flex-col gap-1.5 text-sm text-muted">
                  {["Pensar qué decir y escribir el guion", "Grabarte o buscar a alguien que grabe", "Editar, poner subtítulos, exportar", "Repetirlo cada vez que el anuncio se cansa"].map((x) => <li key={x}>— {x}</li>)}
                </ul>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl border-2 border-transparent p-5 [background:linear-gradient(var(--surface),var(--surface))_padding-box,var(--grad)_border-box]">
                <b>Con Creads</b>
                <ul className="flex flex-col gap-1.5 text-sm">
                  {["Copias lo que ya le funciona a otros", "La IA escribe, habla y graba por ti", "Recibes el anuncio editado", "Haces versiones nuevas cuando quieras"].map((x) => <li key={x} className="flex gap-2"><Check />{x}</li>)}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* How it works: the five steps, in order */}
        <section id="como" className={`scroll-mt-24 ${gutter}`} aria-labelledby="como-title">
          <div className={`${wrap} flex flex-col gap-8`}>
            <div className="flex max-w-3xl flex-col gap-3">
              <h2 id="como-title" className="text-[2rem] leading-tight font-extrabold sm:text-[2.6rem]">Cómo funciona: de la idea al anuncio en 5 pasos</h2>
              <p className="text-lg text-muted">Todo pasa dentro de Creads. En cada paso ves el resultado y decides si sigues o cambias algo.</p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {STEPS.map((st, i) => (
                <li key={st.k} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3">
                  <div className="h-52">{art(st.k)}</div>
                  <span className="flex items-center gap-2 px-1"><b className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-xs text-bg">{i + 1}</b><b className="text-[17px] leading-tight">{st.title}</b></span>
                  <p className="px-1 pb-1 text-sm text-muted">{st.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* The two ways to have a person on camera */}
        <section className={gutter} aria-labelledby="persona-title">
          <div className={`${wrap} flex flex-col gap-8`}>
            <div className="flex max-w-3xl flex-col gap-3">
              <h2 id="persona-title" className="text-[2rem] leading-tight font-extrabold sm:text-[2.6rem]">¿Quién aparece en tu anuncio? Tú eliges.</h2>
              <p className="text-lg text-muted">Los dos hablan con la voz que aprobaste y con los labios sincronizados.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { title: "Persona IA", text: "Una persona creada con IA, siempre la misma cara, en el lugar que pidas para cada escena: tu local, una casa, un mall, el auto. No necesitas grabar nada.", img: SCENES.realtor.src, tag: "Sin grabar" },
                { title: "Tu persona real", text: "Subes una vez un video de 30 a 60 segundos tuyo, o de alguien que te dio permiso, hablando al celular. Creads lo usa en cada anuncio con la voz nueva en los labios.", img: SCENES.car.src, tag: "Lo más real" },
              ].map((x) => (
                <article key={x.title} className="grid grid-cols-[120px_1fr] gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[150px_1fr]">
                  <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-surface-2"><Image src={x.img} alt="" fill sizes="150px" className="object-cover" /></div>
                  <div className="flex flex-col gap-2">
                    <span className="w-fit rounded-full bg-accent/12 px-2.5 py-0.5 text-xs font-bold text-accent-text">{x.tag}</span>
                    <h3 className="text-xl font-extrabold">{x.title}</h3>
                    <p className="text-sm text-muted">{x.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* What arrives every month, in quantities */}
        <section id="recibes" className={`scroll-mt-24 ${gutter}`} aria-labelledby="recibes-title">
          <div className={`${wrap} flex flex-col gap-8`}>
            <div className="flex max-w-3xl flex-col gap-3">
              <h2 id="recibes-title" className="text-[2rem] leading-tight font-extrabold sm:text-[2.6rem]">Contenido para anunciar todo el mes</h2>
              <p className="text-lg text-muted">Un anuncio se cansa en semanas. Con Creads siempre tienes versiones nuevas para probar cuál vende más.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
                <span className="font-display text-5xl font-semibold">4 a 10</span>
                <b>anuncios en video al mes</b>
                <p className="text-sm text-muted">De 30 segundos, verticales, con voz, subtítulos y tu estilo. Según tu plan.</p>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
                <span className="font-display text-5xl font-semibold">20 a 50</span>
                <b>imágenes para anuncios</b>
                <p className="text-sm text-muted">En 4:5 para el feed, con tu producto o tu avatar, con ideas distintas para probar.</p>
              </div>
              <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
                <span className="font-display text-5xl font-semibold">Incluido</span>
                <b>espiar y escribir guiones</b>
                <p className="text-sm text-muted">Buscar anuncios ganadores y crear guiones no descuenta segundos de tu plan.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {[SCENES.serum, SCENES.chef, SCENES.sneaker].map((x) => (
                <div key={x.src} className="relative aspect-[4/5] overflow-hidden rounded-xl bg-surface-2"><Image src={x.src} alt="Imagen para anuncio hecha con IA" fill sizes="200px" className="object-cover" /></div>
              ))}
              {(["coach", "valpo", "serum"] as const).map((k) => (
                <div key={k} className="relative aspect-[4/5] overflow-hidden rounded-xl bg-surface-2"><LoopVideo src={VIDEOS[k]!} poster={poster(SCENES[k].src)} className="absolute inset-0 h-full w-full object-cover" /></div>
              ))}
            </div>
            <p className="text-xs text-muted">Ejemplos hechos con IA.</p>
          </div>
        </section>

        {/* The two plans */}
        <section id="pricing" className={`scroll-mt-24 ${gutter}`} aria-labelledby="pricing-title">
          <div className={`${wrap} flex flex-col gap-8`}>
            <div className="flex max-w-3xl flex-col gap-3">
              <h2 id="pricing-title" className="text-[2rem] leading-tight font-extrabold sm:text-[2.6rem]">Dos planes. Elige cuántos anuncios necesitas.</h2>
              <p className="text-lg text-muted">{emprende.name}: el primer mes a {first}, luego {usd(emprende.monthly)}. {negocio.name}: {usd(negocio.monthly)} al mes para publicar todas las semanas. Sin permanencia.</p>
            </div>
            <Pricing t={t.pricing} lang="es" rate={rate} renews={renews} />
          </div>
        </section>

        {/* Objections */}
        <section id="preguntas" className={`scroll-mt-24 ${gutter}`} aria-labelledby="faq-title">
          <div className={`${wrap} grid gap-8 lg:grid-cols-[0.8fr_1.2fr]`}>
            <h2 id="faq-title" className="text-[2rem] leading-tight font-extrabold sm:text-[2.6rem]">Preguntas antes de empezar</h2>
            <div className="flex flex-col divide-y divide-line border-y border-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{q}<span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-45">+</span></summary>
                  <p className="pt-2 text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Last call */}
        <section className={gutter}>
          <div className={`${wrap} relative flex flex-col items-center gap-5 overflow-hidden rounded-[2rem] border border-line bg-surface px-6 py-16 text-center`}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-25 blur-[90px]" style={{ background: "var(--grad)" }} />
            <h2 className="relative max-w-3xl text-[2.1rem] leading-tight font-black sm:text-5xl">Tu próximo anuncio puede estar listo hoy.</h2>
            <p className="relative max-w-[52ch] text-lg text-muted">Creas tu cuenta en un minuto, pagas y entras directo a hacer tu primer anuncio.</p>
            <a href={startHref("starter")} className="relative rounded-xl bg-[image:var(--grad)] px-7 py-3.5 font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)]">Empezar con {emprende.name} por {first}</a>
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
