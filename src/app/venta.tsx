import Image from "next/image";
import type { Content } from "@/content/en";
import { tarjetaObligatoria } from "@/lib/regalo";
import { SHOWN_PLANS, usd } from "@/lib/catalog";
import { Logo } from "./brand";
import Pricing from "./pricing";
import ThemeToggle from "./theme-toggle";
import FunnelNudges from "./funnel-nudges";
import WhatsAppButton from "./whatsapp";
import DemoPhone from "./demo-phone";
import Muro from "./muro";
import { SCENES } from "./landing";
import Casos from "./casos";
import { Money, MoneyText } from "./money";

// The home page for people who arrive from an ad (owner, 22 Oct 2026: "que cada persona que llegue no se
// aguante de suscribirse"). One job: show real ads Creads made, explain the two ways to make one
// (Automático / Manual), and get them to pick a plan. Every section answers one question a buyer has, in
// order: what do I get? → how do I make it? → why not record it myself or hire someone? → how does it work?
// → who appears? → how much? → doubts. The demo videos in /public/demos are real Creads ads (21 Oct 2026).

const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";
const wrap = "mx-auto w-full max-w-6xl";
const h2 = "font-display text-[1.7rem] leading-[1.1] font-semibold sm:text-[2.3rem]";

// the checkout link (pricing.tsx is a client module: its helper can't run here)
const startHref = (plan: string) => `/empezar?plan=${plan}&periodo=mensual`;
/** Free sign-up, no card: the first ad is a gift (owner, 23 Oct 2026, launch audit). */
const FREE = "/registro";

const emprende = SHOWN_PLANS.find((p) => p.id === "starter")!;
/** The cheapest plan on sale (for «desde US$…»). */
const cheapest = [...SHOWN_PLANS].sort((a, b) => a.monthly - b.monthly)[0];

const DEMOS = {
  cafe: { src: "/demos/cafeteria.mp4", poster: "/demos/cafeteria.jpg", label: "Cafetería" },
  dent: { src: "/demos/dentista.mp4", poster: "/demos/dentista.jpg", label: "Clínica dental" },
  doc: { src: "/demos/doctora.mp4", poster: "/demos/doctora.jpg", label: "Consulta médica" },
  creads: { src: "/demos/creads.mp4", poster: "/demos/creads.jpg", label: "Marca online" },
  rubia: { src: "/demos/rubia.mp4", poster: "/demos/rubia.jpg", label: "Bebida energética" },
  gym: { src: "/demos/gym.mp4", poster: "/demos/gym.jpg", label: "Gimnasio" },
  bano: { src: "/demos/bano.mp4", poster: "/demos/bano.jpg", label: "Cosmética" },
  cocina: { src: "/demos/cocina.mp4", poster: "/demos/cocina.jpg", label: "Vida sana" },
};

// Product videos made with «Video de producto» and two UGC ads, all real Creads outputs (owner, 25 Oct 2026).
const PRODUCTO = {
  blendgo: { src: "/demos/prod-blendgo.mp4", poster: "/demos/prod-blendgo.jpg", label: "Licuadora portátil" },
  serum: { src: "/demos/prod-serum.mp4", poster: "/demos/prod-serum.jpg", label: "Sérum" },
  cafe: { src: "/demos/prod-cafe.mp4", poster: "/demos/prod-cafe.jpg", label: "Café" },
  celular: { src: "/demos/prod-celular.mp4", poster: "/demos/prod-celular.jpg", label: "Celular" },
  zapatillas: { src: "/demos/prod-zapatillas.mp4", poster: "/demos/prod-zapatillas.jpg", label: "Zapatillas" },
  perfume: { src: "/demos/prod-perfume.mp4", poster: "/demos/prod-perfume.jpg", label: "Perfume" },
  ugcProteina: { src: "/demos/ugc-proteina.mp4", poster: "/demos/ugc-proteina.jpg", label: "UGC · proteína" },
  ugcDepto: { src: "/demos/ugc-depto.mp4", poster: "/demos/ugc-depto.jpg", label: "UGC · inmobiliaria" },
};
/** The hero reel: product videos and UGC cut fast, to the beat. */
const REEL = { src: "/demos/reel-producto.mp4", poster: "/demos/reel-producto.jpg", label: "Videos de producto y UGC hechos con Creads" };
const MURO_VIDEOS = [PRODUCTO.celular, PRODUCTO.ugcProteina, PRODUCTO.blendgo, PRODUCTO.zapatillas, PRODUCTO.ugcDepto, PRODUCTO.serum, PRODUCTO.perfume, PRODUCTO.cafe];

const STEPS = [
  { title: "Cuéntale tu negocio", text: "Qué vendes, a quién y qué quieres que hagan: comprar, agendar, escribirte.", why: "Así el anuncio habla de tu oferta real, no de algo genérico." },
  { title: "Aprueba el guion y la persona", text: "Creads te propone guiones con gancho y la persona que va a hablar, en tu tipo de local.", why: "No se gasta nada en video hasta que tú dices que sí." },
  { title: "Creads hace el video y lo revisa", text: "Voz con acento chileno u otro latino, labios sincronizados, cortes y subtítulos. Luego escucha cada palabra y mira cada escena.", why: "Si encuentra un error, te marca qué escena rehacer y la regeneras con un clic." },
  { title: "Descárgalo y publícalo", text: "Vertical, listo para Reels, TikTok y Stories. Haz variaciones para probar cuál vende más.", why: "Un anuncio se cansa en semanas: siempre tienes uno nuevo." },
] as const;

// with the card trial (REGALO_CON_TARJETA) the copy can't say «sin tarjeta»
const CON_TARJETA = tarjetaObligatoria();
const FAQ = [
  ["¿Puedo probar antes de pagar?", CON_TARJETA ? "Sí. Creas tu cuenta, agregas tu tarjeta en Mercado Pago (hoy no se cobra nada) y te regalamos 200 créditos para tu primer anuncio. Tienes 7 días de prueba: si no te sirve, cancelas en Planes con un clic y no pagas nada. También puedes espiar anuncios y crear guiones gratis (5 al día)." : "Sí. Creas tu cuenta gratis, sin tarjeta, y al tiro te regalamos 200 créditos para tu primer anuncio de unos 12 segundos, listo para publicar. También puedes espiar anuncios y crear guiones gratis (5 al día)."],
  ["¿Qué diferencia hay entre Automático y Manual?", "En Automático conversas con Creads como con una agencia: te pregunta, propone, hace el video, lo revisa y te lo entrega. En Manual haces cada paso tú (guion, voz, escenas, edición) y decides cada detalle. Puedes usar los dos con el mismo plan."],
  ["¿Necesito saber de inteligencia artificial o de edición?", "No. Escribes en tus palabras qué vendes y a quién. Creads escribe el guion, crea a la persona, pone la voz y edita. Tú solo apruebas."],
  ["¿Se ve real?", "Mira los ejemplos de arriba: ninguna de esas personas existe. Si prefieres algo 100% real, subes un video tuyo hablando al celular y Creads le pone la voz nueva en los labios en cada anuncio."],
  ["¿En qué idioma y con qué acento?", "En español con acento chileno, argentino, colombiano, venezolano o mexicano, o en inglés. También puedes usar tu propia voz."],
  ["¿Qué pasa si un video falla?", "Si la IA no entrega el video, los créditos vuelven solos a tu saldo. Y antes de entregarte un anuncio, Creads lo revisa y te marca los posibles errores. Si quieres rehacer una escena, la regeneras con un clic: eso usa créditos de tu saldo, como una escena nueva."],
  ["¿Cómo pago?", "Con tarjeta de crédito, débito o saldo de Mercado Pago, en pesos chilenos al cambio del día. Creads nunca ve tu tarjeta y el comprobante te llega al correo."],
  ["¿Puedo cancelar?", "Sí, cuando quieras, desde tu cuenta y con un clic. Sin permanencia: sigues usando tu plan hasta la fecha que pagaste."],
] as const;

function Check({ className = "text-good" }: { className?: string }) {
  return <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 ${className}`} aria-hidden="true"><path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Cta({ children, href = startHref("starter"), sub }: { children: React.ReactNode; href?: string; sub?: string }) {
  return (
    <a href={href} className="flex w-full flex-col items-center rounded-xl bg-[image:var(--grad)] px-6 py-3 text-center font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)] transition-transform hover:-translate-y-px sm:w-auto">
      <span className="text-[17px]">{children}</span>
      {sub && <span className="text-xs font-normal text-white/85">{sub}</span>}
    </a>
  );
}

/** Automático, as it looks: a short conversation. */
function ChatMock() {
  const row = (who: "c" | "t", text: string) => (
    <p className={`max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${who === "t" ? "ml-auto rounded-br-md bg-ink text-bg" : "rounded-bl-md bg-surface-2"}`}>{text}</p>
  );
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-bg p-3">
      {row("c", "¿Qué vendes y qué quieres que haga la gente al ver el anuncio?")}
      {row("t", "Tengo una clínica dental en Providencia. Quiero que agenden su evaluación.")}
      {row("c", "Listo. Te propongo 2 guiones y la foto del doctor. Elige uno y lo hago.")}
      <span className="flex w-fit items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] text-muted"><Check className="text-good" />Revisado: dice el guion completo</span>
    </div>
  );
}

/** Manual, as it looks: the steps you control. */
function StepsMock() {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-bg p-3 text-[13px]">
      {[["Guion", "3 guiones + 10 ganchos"], ["Voz", "escuchas cada frase"], ["Escenas", "eliges dónde pasa"], ["Video", "corte por corte"], ["Edición", "títulos, subtítulos, marca"]].map(([k, v], i) => (
        <span key={k} className="flex items-center gap-2.5 rounded-lg bg-surface-2 px-2.5 py-1.5">
          <b className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[10px] text-bg">{i + 1}</b>
          <b>{k}</b><span className="truncate text-muted">{v}</span>
        </span>
      ))}
    </div>
  );
}

export default function Venta({ t, rate = 950, renews = true }: { t: Content; rate?: number; renews?: boolean }) {
  return (
    <div className="overflow-x-clip pb-20 lg:pb-0">
      <FunnelNudges t={t.nudge} lang={t.lang} rate={rate} tarjeta={CON_TARJETA} />
      <WhatsAppButton />

      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-line/60 bg-bg/85 backdrop-blur">
        <div className={`${wrap} flex items-center justify-between gap-3 py-3 ${gutter}`}>
          <Logo href="/" />
          <nav aria-label="Secciones" className="hidden items-center gap-1 text-[15px] md:flex">
            {[["#formas", "Automático o Manual"], ["#como", "Cómo funciona"], ["#pricing", "Planes"], ["#preguntas", "Preguntas"]].map(([h, l]) => (
              <a key={h} href={h} className="rounded-lg px-3 py-2 text-muted hover:bg-surface hover:text-ink">{l}</a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="hidden min-[420px]:contents"><ThemeToggle lang="es" /></span>
            <a href="/app" className="px-2 text-sm font-semibold text-muted hover:text-ink">Entrar</a>
            <a href={FREE} className="whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-bg hover:opacity-90 sm:px-4">Probar gratis</a>
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-16 pb-16 sm:gap-24">
        {/* 1 · Hero: the promise, and three real ads made by Creads (people who don't exist) */}
        <section className={`stage relative -mt-px overflow-hidden ${gutter}`}>
          <div className={`${wrap} relative grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1fr_1fr]`}>
            <div className="flex min-w-0 flex-col gap-5">
              <h1 className="font-display text-[2.3rem] leading-[1.03] font-semibold sm:text-[3.5rem]">
                Anuncios en video que venden. <span className="chroma">Sin grabar a nadie.</span>
              </h1>
              {/* phones: one real ad with sound right under the headline, above the fold */}
              <DemoPhone {...DEMOS.cafe} big sound className="mx-auto w-[48vw] max-w-[210px] lg:hidden" />
              <p className="max-w-[50ch] text-lg text-muted">
                Cuéntale a Creads qué vendes y recibe tu anuncio listo para Facebook, Instagram y TikTok: guion, persona, voz chilena y edición, en minutos.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Cta href={FREE} sub={CON_TARJETA ? "7 días gratis. Hoy no se cobra nada: 200 créditos para tu primer anuncio." : "Sin tarjeta. Te regalamos 200 créditos para tu primer anuncio."}>Crea tu primer anuncio gratis</Cta>
                <a href="#formas" className="rounded-xl border border-line bg-surface/60 px-5 py-3 text-center font-semibold backdrop-blur hover:bg-surface">Ver cómo se hace</a>
              </div>
              <ul className="grid gap-1.5 text-sm text-muted sm:grid-cols-2">
                {["Tu primer anuncio de regalo", "Listo en minutos, no en días", "Revisado antes de entregártelo", `Después, desde ${usd(cheapest.monthly)} al mes`].map((x) => <li key={x} className="flex items-center gap-1.5"><Check /><MoneyText text={x} rate={rate} /></li>)}
              </ul>
            </div>

            <div className="relative hidden justify-center py-4 lg:flex">
              <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[image:var(--grad)] opacity-30 blur-[110px]" />
              <DemoPhone {...REEL} big className="relative w-72" />
            </div>
          </div>
          {/* the wall: product videos and UGC moving */}
          <div className="relative -mx-[max(16px,env(safe-area-inset-left,0px))] pb-12 sm:pb-16">
            <Muro videos={MURO_VIDEOS} />
          </div>
        </section>

        {/* Gallery «Hecho con Creads» (owner, 25 Oct 2026: silent): real ads by type of business */}
        <section id="galeria" className={`scroll-mt-20 ${gutter}`} aria-labelledby="galeria-title">
          <div className={`${wrap} flex flex-col gap-5`}>
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 id="galeria-title" className={h2}>Hecho con Creads</h2>
              <p className="text-muted">Anuncios reales que salieron de Creads, para distintos rubros. Las personas no existen: las creó la IA.</p>
            </div>
            <div className="scroll-row flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible lg:grid-cols-8">
              {(["dent", "doc", "cafe", "creads", "gym", "rubia", "bano", "cocina"] as const).map((k) => (
                <DemoPhone key={k} {...DEMOS[k]} className="w-[42vw] max-w-[180px] shrink-0 snap-start sm:w-auto sm:max-w-none" />
              ))}
            </div>
            <Cta href={FREE} sub={CON_TARJETA ? "7 días gratis. Hoy no se cobra nada." : "Sin tarjeta. Te regalamos 200 créditos."}>Crea el tuyo gratis</Cta>
          </div>
        </section>

        {/* Product videos: three side by side, the style under each */}
        <section className={`stage relative overflow-hidden py-14 sm:py-20 ${gutter}`} aria-labelledby="producto-title">
          <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[image:var(--grad)] opacity-25 blur-[120px]" />
          <div className={`${wrap} relative grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]`}>
            <div className="flex flex-col gap-4">
              <h2 id="producto-title" className={h2}>Tu producto, en <span className="chroma">movimiento</span></h2>
              <p className="max-w-[46ch] text-lg text-muted">Sube una foto de tu producto y elige un estilo. En minutos tienes un video de 6 segundos que parece de estudio: sin modelos, sin grabar, sin editar.</p>
              <ul className="flex flex-wrap gap-2">
                {["Salpicadura", "Giro 360", "Flotando", "Macro", "Unboxing", "En su lugar"].map((x) => (
                  <li key={x} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm font-semibold">{x}</li>
                ))}
              </ul>
              <p className="text-sm text-muted">Tecnología, moda, belleza, comida, suplementos: sirve para cualquier producto que se venda por foto.</p>
              <div className="self-start"><Cta href="/app/video-producto">Haz el video de tu producto</Cta></div>
            </div>
            <div className="grid grid-cols-3 items-center gap-3 sm:gap-5">
              {([[PRODUCTO.zapatillas, "Salpicadura"], [PRODUCTO.celular, "Salpicadura"], [PRODUCTO.perfume, "Salpicadura"]] as const).map(([d, estilo], i) => (
                <div key={d.src} className={i === 1 ? "-mt-10" : "mt-10"}>
                  <DemoPhone {...d} label={`${d.label} · ${estilo}`} big={i === 1} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2 · Automático or Manual: the two ways to make an ad */}
        <section id="formas" className={`scroll-mt-20 ${gutter}`} aria-labelledby="formas-title">
          <div className={`${wrap} flex flex-col gap-6`}>
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 id="formas-title" className={h2}>Hazlo conversando o paso a paso</h2>
              <p className="text-muted">Dos formas de llegar al mismo anuncio. Las dos vienen en tu plan.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { name: "Automático", tag: "Recomendado", fit: "Para el que no tiene tiempo", text: "Conversas con Creads como con tu agencia. Te pregunta lo necesario, te propone el guion y la persona, hace el video, lo revisa y te lo entrega.", mock: <ChatMock />, hot: true },
                { name: "Manual", tag: "Control total", fit: "Para el que quiere decidir cada detalle", text: "Tú armas cada paso: espías los anuncios que le funcionan a tu competencia, eliges el guion, la voz, cada escena y la edición.", mock: <StepsMock />, hot: false },
              ].map((x) => (
                <article key={x.name} className={`flex flex-col gap-4 rounded-3xl border p-5 sm:p-6 ${x.hot ? "border-transparent bg-surface [background:linear-gradient(var(--color-surface),var(--color-surface))_padding-box,var(--grad)_border-box] border-2" : "border-line bg-surface"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-2xl font-semibold">{x.name}</h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${x.hot ? "bg-[image:var(--grad)] text-white" : "bg-surface-2 text-muted"}`}>{x.tag}</span>
                  </div>
                  <p className="text-[15px]"><b>{x.fit}.</b> <span className="text-muted">{x.text}</span></p>
                  {x.mock}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* 3 · Why Creads: against recording it yourself or hiring someone */}
        <section className={gutter} aria-labelledby="porque-title">
          <div className={`${wrap} flex flex-col gap-6`}>
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 id="porque-title" className={h2}>Lo que antes era un día de trabajo</h2>
              <p className="text-muted">Para vender con anuncios necesitas videos nuevos todo el tiempo. Así se compara cada camino.</p>
            </div>
            <div className="overflow-hidden rounded-3xl border border-line">
              <table className="w-full text-left text-sm sm:text-[15px]">
                <thead>
                  <tr className="bg-surface-2 text-xs sm:text-sm">
                    <th scope="col" className="p-3 sm:p-4"><span className="sr-only">Comparación</span></th>
                    <th scope="col" className="hidden p-3 font-semibold text-muted sm:table-cell sm:p-4">Grabarlo tú</th>
                    <th scope="col" className="p-3 font-semibold text-muted sm:p-4">Agencia o creador</th>
                    <th scope="col" className="bg-ink p-3 font-semibold text-bg sm:p-4">Con Creads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {[
                    ["Tiempo", "Medio día grabando y editando", "Días o semanas", "Minutos"],
                    ["Qué necesitas", "Cámara, luz y salir bien", "Brief, reuniones y correcciones", "Contar qué vendes"],
                    ["Costo", "Tu tiempo", "Se cobra cada video", `Plan desde ${usd(cheapest.monthly)} al mes`],
                    ["Video al mes", "Lo que alcances a grabar", "Lo que pagues aparte", "≈ 2 a 17 anuncios de 15 s"],
                  ].map(([k, a, b, c]) => (
                    <tr key={k}>
                      <th scope="row" className="p-3 font-semibold sm:p-4">{k}</th>
                      <td className="hidden p-3 text-muted sm:table-cell sm:p-4">{a}</td>
                      <td className="p-3 text-muted sm:p-4">{b}</td>
                      <td className="p-3 font-semibold sm:p-4"><span className="flex items-start gap-1.5"><Check className="mt-0.5 text-good" /><MoneyText text={c} rate={rate} /></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 4 · How it works: four steps, each with its reason */}
        <section id="como" className={`scroll-mt-20 ${gutter}`} aria-labelledby="como-title">
          <div className={`${wrap} flex flex-col gap-6`}>
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 id="como-title" className={h2}>Cómo funciona</h2>
              <p className="text-muted">Igual en Automático y en Manual. Tú apruebas antes de gastar.</p>
            </div>
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((st, i) => (
                <li key={st.title} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
                  <b className="font-display text-3xl font-semibold text-transparent [-webkit-text-stroke:1px_var(--color-ink)]" aria-hidden="true">{i + 1}</b>
                  <h3 className="text-lg leading-tight font-bold">{st.title}</h3>
                  <p className="text-sm text-muted">{st.text}</p>
                  <p className="mt-auto border-t border-line pt-2 text-sm"><b>Por qué: </b>{st.why}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* 5 · Who appears in the ad */}
        <section className={gutter} aria-labelledby="quien-title">
          <div className={`${wrap} flex flex-col gap-6`}>
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 id="quien-title" className={h2}>¿Quién aparece en tu anuncio?</h2>
              <p className="text-muted">Elige en cada anuncio. Siempre la misma cara, la misma ropa y en el lugar que pidas.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                { title: "Persona IA", tag: "Sin grabar nada", text: "Creads crea a la persona ideal para tu negocio y la pone donde quieras: tu local, una consulta, una casa, un mall. Como los ejemplos de arriba.", img: DEMOS.creads.poster },
                { title: "Tu persona real", tag: "Lo más real", text: "Subes una vez un video de 30 a 60 segundos hablando al celular, tuyo o de alguien que te dio permiso. Creads le pone la voz nueva en los labios en cada anuncio.", img: SCENES.car.src },
              ].map((x) => (
                <article key={x.title} className="grid grid-cols-[96px_1fr] items-center gap-4 rounded-3xl border border-line bg-surface p-3 sm:grid-cols-[120px_1fr]">
                  <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-surface-2"><Image src={x.img} alt="" fill sizes="120px" className="object-cover" /></div>
                  <div className="flex flex-col gap-1.5 pr-2">
                    <span className="flex flex-wrap items-center gap-2"><h3 className="font-display text-xl font-semibold">{x.title}</h3><span className="rounded-full bg-accent/12 px-2 py-0.5 text-xs font-bold text-accent-text">{x.tag}</span></span>
                    <p className="text-sm text-muted">{x.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* real customers, only with their permission (empty until there are) */}
        <Casos />

        {/* 6 · Plans: what you get every month, then the two plans */}
        <section id="pricing" className={`scroll-mt-20 ${gutter}`} aria-labelledby="pricing-title">
          <div className={`${wrap} flex flex-col gap-6`}>
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 id="pricing-title" className={h2}>Elige tu plan</h2>
              <p className="text-muted">Sin permanencia ni letra chica. Automático, Manual, espiar a la competencia y escribir guiones vienen incluidos.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[["≈ 2 a 17", "anuncios de 15 s al mes"], [`Desde ${usd(cheapest.monthly)}`, "al mes, sin permanencia"], ["Gratis", "pruébalo: espía anuncios y crea guiones sin pagar"]].map(([n, k]) => (
                <div key={k} className="flex flex-col gap-0.5 rounded-2xl border border-line bg-surface p-3 sm:p-4">
                  <span className="font-display text-xl font-semibold sm:text-3xl"><MoneyText text={n} rate={rate} /></span>
                  <span className="text-xs text-muted sm:text-sm">{k}</span>
                </div>
              ))}
            </div>
            <Pricing t={t.pricing} lang="es" rate={rate} renews={renews} compact />
            <p className="max-w-3xl text-sm text-muted">Un solo saldo para todo: videos, imágenes y voces descuentan del mismo saldo, así que puedes repartirlo como quieras. Un segundo de video con el modelo recomendado usa unos 11 créditos; algunos modelos usan más, y antes de crear siempre ves cuántos créditos cuesta. El saldo dura el mes que pagaste: lo que no uses vence al terminar y no se acumula.</p>
          </div>
        </section>

        {/* 7 · Doubts before paying */}
        <section id="preguntas" className={`scroll-mt-20 ${gutter}`} aria-labelledby="faq-title">
          <div className={`${wrap} grid gap-6 lg:grid-cols-[0.7fr_1.3fr]`}>
            <h2 id="faq-title" className={h2}>Preguntas antes de empezar</h2>
            <div className="flex flex-col divide-y divide-line border-y border-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-3.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{q}<span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-45">+</span></summary>
                  <p className="pt-2 text-muted">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 8 · Last call */}
        <section className={gutter}>
          <div className={`${wrap} relative grid items-center gap-8 overflow-hidden rounded-[2rem] border border-line bg-surface px-6 py-10 sm:px-10 md:grid-cols-[1.3fr_0.7fr]`}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20 blur-[90px]" style={{ background: "var(--grad)" }} />
            <div className="relative flex min-w-0 flex-col items-start gap-4">
              <h2 className="font-display text-[1.8rem] leading-tight font-semibold sm:text-4xl">Tu próximo anuncio puede estar publicado hoy.</h2>
              <p className="text-muted">Empieza con {emprende.name} por <Money usd={emprende.monthly} rate={rate} /> al mes. Si no te sirve, cancelas con un clic.</p>
              <Cta>Hacer mi primer anuncio</Cta>
            </div>
            <div className="relative mx-auto flex min-w-0 max-w-full items-end">
              <DemoPhone {...DEMOS.bano} className="relative z-0 -mr-6 w-24 -rotate-6 sm:w-36" />
              <DemoPhone {...DEMOS.creads} className="relative z-10 w-32 sm:w-44" />
              <DemoPhone {...DEMOS.cocina} className="relative z-0 -ml-6 w-24 rotate-6 sm:w-36" />
            </div>
          </div>
        </section>
      </main>

      <footer className={`border-t border-line ${gutter}`}>
        <div className={`${wrap} flex flex-col gap-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between`}>
          <span>© {new Date().getFullYear()} Creads IA · hola@creadsia.com</span>
          <span className="flex flex-wrap gap-4">
            <a href="/terminos" className="hover:text-ink">Términos y condiciones</a>
            <a href="/privacidad" className="hover:text-ink">Política de privacidad</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
