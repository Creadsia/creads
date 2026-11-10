import Image from "next/image";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Content } from "@/content/en";
import { PRUEBA, SHOWN_PLANS, usd } from "@/lib/catalog";
import { PRUEBA_DIAS, PRUEBA_PLAN } from "@/lib/oferta";
import { Logo } from "./brand";
import Pricing from "./pricing";
import ThemeToggle from "./theme-toggle";
import FunnelNudges from "./funnel-nudges";
import WhatsAppButton from "./whatsapp";
import DemoPhone from "./demo-phone";
import ActorStage from "./actor-stage";
import { Money, MoneyText } from "./money";
import Ejemplos from "./ejemplos";
import { GARANTIA } from "@/lib/garantia-textos";
import GaleriaCreads from "./galeria-creads";
import { InsigniasPago } from "./pay-badges";
import { SoporteLinea } from "./whatsapp";
import type { Contador, GaleriaPublicaItem, Novedad } from "@/lib/confianza";
import type { TestimonioPublico } from "@/lib/casos";

/** Real data for the trust blocks (owner's plan, 25 Oct 2026): every block hides itself when its list is empty. */
export interface Confianza { galeria: GaleriaPublicaItem[]; contadores: Contador[]; testimonios: TestimonioPublico[]; novedades: Novedad[]; roadmap: boolean }
const SIN_DATOS: Confianza = { galeria: [], contadores: [], testimonios: [], novedades: [], roadmap: false };

/** «Así se gasta tu saldo»: what each piece uses (the same numbers as the app charges, src/lib/credit-math.ts). */
const GASTO = [
  ["Imagen con texto, en feed 4:5, stories 9:16 y cuadrado", "10 créditos"],
  ["La misma imagen con Nano Banana Pro (mayor calidad)", "20 créditos"],
  ["Video de producto de 6 s (escena + movimiento + titular)", "15 créditos"],
  ["Video con avatar que habla, 15 s", "25 créditos"],
  ["Ángulos, hooks y editar textos, subtítulos, logo o música", "Gratis"],
] as const;

// The home page (owner's plan, 25 Oct 2026). Main audience: people who already spend on Meta ads (ecommerce,
// affiliates and media buyers, info-product sellers); small businesses come second. One promise: test many
// ads a month, not three. Order asked by the owner: hero with the promise and a 2-minute demo → how it works in
// 3 steps → real examples → comparison → plans → guarantee → founder → questions → last call.
// Everything shown as an example is a real Creads output: the videos in /public/demos (21 Oct 2026) and the
// images in /public/ejemplos (made with Creads on 25 Oct 2026: invented brands; see src/lib/ideas.ts).

const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";
const wrap = "mx-auto w-full max-w-6xl";
const h2 = "font-display text-[1.7rem] leading-[1.1] font-semibold sm:text-[2.3rem]";

/** Sign-up (with the card for the 7-day free trial; or the Pack Prueba with MODO_PACK=1), then the first batch. */
const START = "/registro";
/** El regalo de la prueba en palabras (owner, 9 nov 2026): REGALO_CREDITS=100 ≈ 1 minuto de video / 4 cortes de
 * 15 s, para que la prueba saque su primer anuncio completo. Más fuerte que decir «100 créditos». */
const REGALO_HUMANO = "1 minuto de video gratis";
const REGALO_LARGO = "1 minuto de video gratis (4 cortes de 15 s) para tu primer anuncio";
const cheapest = [...SHOWN_PLANS].sort((a, b) => a.monthly - b.monthly)[0];
/** The plan the free trial becomes (Testea): its real price, never written by hand. */
const planPrueba = SHOWN_PLANS.find((p) => p.id === PRUEBA_PLAN) ?? cheapest;

/** The founder's photo, when it's in /public (owner, 25 Oct 2026). */
const FOTO_FUNDADOR = existsSync(path.join(process.cwd(), "public", "fundador.jpg"));

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

/** Two real UGC ads made with Creads, kept as extra actors in the hero cast (owner, 25 Oct 2026). */
const UGC_DEMOS = [
  { src: "/demos/ugc-proteina.mp4", poster: "/demos/ugc-proteina.jpg", label: "UGC · proteína" },
  { src: "/demos/ugc-depto.mp4", poster: "/demos/ugc-depto.jpg", label: "UGC · inmobiliaria" },
];
/** UGC nuevos ultra-reales (owner, 9 nov 2026): personas IA hablando a cámara, distintos rubros. Cada uno se
 * muestra solo si su archivo existe, así se van sumando a la portada a medida que se generan en la GPU. */
const UGC_NUEVOS = [
  { src: "/demos/ugc-skincare.mp4", poster: "/demos/ugc-skincare.jpg", label: "UGC · skincare" },
  { src: "/demos/ugc-fitness.mp4", poster: "/demos/ugc-fitness.jpg", label: "UGC · fitness" },
  { src: "/demos/ugc-tienda.mp4", poster: "/demos/ugc-tienda.jpg", label: "UGC · tienda online" },
  { src: "/demos/ugc-cafeteria.mp4", poster: "/demos/ugc-cafeteria.jpg", label: "UGC · cafetería" },
  { src: "/demos/ugc-automotora.mp4", poster: "/demos/ugc-automotora.jpg", label: "UGC · automotora" },
  { src: "/demos/ugc-mediabuyer.mp4", poster: "/demos/ugc-mediabuyer.jpg", label: "UGC · media buyer" },
].filter((d) => existsSync(path.join(process.cwd(), "public", d.src)));

/** Elenco de actores IA para el hero (solo personas hablando, nada de productos «chantas»): los UGC nuevos
 * primero y después los avatares que ya teníamos. El escenario del hero va cambiando de actor con estos. */
const CARAS = [
  ...UGC_NUEVOS,
  DEMOS.doc, DEMOS.rubia, DEMOS.gym, DEMOS.dent, DEMOS.cafe, DEMOS.bano, DEMOS.cocina, DEMOS.creads,
  ...UGC_DEMOS,
];

/** El video que se muestra «editándose» en la sección del editor (un UGC real), y el subtítulo karaoke. */
const EDITOR_CLIP = CARAS[0] ?? DEMOS.doc;
const EDITOR_CAP = ["ESTO", "ME", "CAMBIÓ", "EL", "NEGOCIO"] as const;

const PASOS = [
  { title: "Pega el link de tu producto", text: "Creads lee tu página: qué vendes, a quién, el precio y la foto del producto. Si no tienes página, lo describes en dos frases." },
  { title: "Elige tus ángulos de venta", text: "Te propone 6: dolor, deseo, mecanismo, prueba social, creencia y oferta. Marcas los que quieres testear." },
  { title: "Descarga tus anuncios", text: "10 anuncios en 4:5 para el feed y 9:16 para stories y reels, con tu marca, en un ZIP ordenado y con el archivo para importarlos en Meta." },
] as const;

/** The two questions about trying it: the 7-day free trial with card (default since 26 Oct 2026) or the Pack Prueba. */
const FAQ_ENTRADA = {
  prueba: [
    ["¿Puedo probar antes de pagar?", `Sí: tienes ${PRUEBA_DIAS} días gratis con ${REGALO_LARGO}. Alcanza para sacar tu primer anuncio completo sin pagar nada hoy. Si te gusta, sigues con el plan ${planPrueba.name} a US$${planPrueba.monthly} al mes, sin permanencia. Si no, cancelas en «Planes» con un clic.`],
  ],
  pack: [
    ["¿Puedo probar antes de suscribirme?", `Sí, con el Pack Prueba: un pago único de US$${PRUEBA.usd}, sin suscripción, que alcanza para tus primeros anuncios: 12 imágenes, 4 videos de producto o 1 video con avatar. Crear la cuenta y ver los 6 ángulos de venta para tu producto no cuesta nada. Si te suscribes dentro de 7 días, los US$${PRUEBA.usd} se descuentan de tu primer mes.`],
    ["¿Necesito tarjeta para crear la cuenta?", "No. La cuenta se crea con tu correo o con Google. Solo pagas cuando compras el Pack Prueba o un plan, en la ventana segura de Mercado Pago."],
  ],
} as const;

const FAQ_RESTO = [
  ["¿Cómo funciona el saldo?", "Cada plan trae un saldo al mes que gastas en imágenes o videos, como quieras: por ejemplo, Escala alcanza para 100 imágenes, 66 videos de producto o 40 videos con avatar, o la mezcla que quieras. Antes de crear siempre ves cuánto usa. Si algo falla, el saldo vuelve solo."],
  ["¿Para qué tipo de negocio sirve?", "Para quien ya invierte en anuncios de Meta y necesita testear ángulos nuevos todo el tiempo: tiendas online, afiliados y media buyers, infoproductos. También para pymes que quieren anuncios propios sin agencia."],
  ["¿En qué idioma salen los anuncios?", "En español o en inglés, tú eliges cada vez. Los videos pueden tener voz con acento chileno, argentino, colombiano, venezolano o mexicano, o en inglés."],
  ["¿Qué pasa si mis anuncios no me sirven?", "Tienes 7 días de garantía en tu primer pago: escríbenos a hola@creadsia.com y te devolvemos tu pago. Los detalles están en «7 días de garantía», más arriba."],
  ["¿Cómo pago?", "Con tarjeta de crédito, débito o saldo de Mercado Pago. Creads nunca ve tu tarjeta y el comprobante te llega al correo."],
  ["¿Puedo cancelar?", "Sí, cuando quieras, desde tu cuenta y con un clic. Sin permanencia: sigues usando tu plan hasta la fecha que pagaste."],
] as const;

function Check({ className = "text-good" }: { className?: string }) {
  return <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 ${className}`} aria-hidden="true"><path d="M5 10.5l3.2 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function Cta({ children, href = START, sub }: { children: React.ReactNode; href?: string; sub?: React.ReactNode }) {
  return (
    <a href={href} className="flex w-full flex-col items-center rounded-xl bg-[image:var(--grad)] px-6 py-3 text-center font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)] transition-transform hover:-translate-y-px sm:w-auto">
      <span className="text-[17px]">{children}</span>
      {sub && <span className="text-xs font-normal text-white/85">{sub}</span>}
    </a>
  );
}

export default function Venta({ t, rate = 950, renews = true, confianza = SIN_DATOS, pack = false }: { t: Content; rate?: number; renews?: boolean; confianza?: Confianza; /** the Pack Prueba is the way in (MODO_PACK=1); else the 7-day free trial with card */ pack?: boolean }) {
  const precioPack = <Money usd={PRUEBA.usd} rate={rate} />;
  // the main button: «Prueba 7 días gratis» (card trial) or «Haz tu primera tanda por US$9» (Pack Prueba)
  const empezar = pack ? <>Haz tus primeros 10 anuncios por {precioPack}</> : <>Prueba {PRUEBA_DIAS} días gratis</>;
  const FAQ = [...FAQ_ENTRADA[pack ? "pack" : "prueba"], ...FAQ_RESTO];
  return (
    <div className="overflow-x-clip pb-20 lg:pb-0">
      <FunnelNudges t={t.nudge} lang={t.lang} rate={rate} pack={pack} />
      <WhatsAppButton />

      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-line/60 bg-bg/85 backdrop-blur">
        <div className={`${wrap} flex items-center justify-between gap-3 py-3 ${gutter}`}>
          <Logo href="/" />
          <nav aria-label="Secciones" className="hidden items-center gap-1 text-[15px] md:flex">
            {[["#como", "Cómo funciona"], ["#editor", "Editor"], ["#ejemplos", "Ejemplos"], ["#pricing", "Planes"], ["#preguntas", "Preguntas"]].map(([h, l]) => (
              <a key={h} href={h} className="rounded-lg px-3 py-2 text-muted hover:bg-surface hover:text-ink">{l}</a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <a href="/en" className="hidden px-2 text-sm font-semibold text-muted hover:text-ink min-[420px]:inline" hrefLang="en" lang="en">English</a>
            <span className="hidden min-[420px]:contents"><ThemeToggle lang="es" /></span>
            <a href="/app" className="hidden min-h-11 items-center px-2 text-sm font-semibold text-muted hover:text-ink min-[420px]:inline-flex">Entrar</a>
            <a href={START} className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl bg-ink px-3 text-sm font-semibold text-bg hover:opacity-90 sm:px-4">Empezar</a>
            {/* phones: a simple menu with the sections */}
            <details className="relative md:hidden">
              <summary className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-xl border border-line" aria-label="Menú">
                <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true"><path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
              </summary>
              <nav aria-label="Secciones" className="absolute right-0 mt-2 flex w-56 flex-col rounded-2xl border border-line bg-surface p-2 shadow-xl">
                {[["#como", "Cómo funciona"], ["#editor", "Editor"], ["#ejemplos", "Ejemplos"], ["#pricing", "Planes"], ["#preguntas", "Preguntas"], ["/app", "Entrar"], ["/en", "English"]].map(([h, l]) => (
                  <a key={h} href={h} className="flex min-h-11 items-center rounded-lg px-3 text-[15px] font-semibold hover:bg-surface-2">{l}</a>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-16 pb-16 sm:gap-24">
        {/* 1 · Hero: «escenario de actores» — el mismo anuncio con el actor IA que elijas (único de Creads). */}
        <section className={`stage relative -mt-px overflow-hidden ${gutter}`}>
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-[440px] w-[640px] -translate-x-1/2 rounded-full bg-[image:var(--grad)] opacity-20 blur-[130px]" />
          <div className={`${wrap} relative grid items-center gap-8 py-10 sm:py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12`}>
            <div className="flex min-w-0 flex-col items-center gap-5 text-center lg:items-start lg:text-left">
              <p className="w-fit rounded-full border border-accent/40 bg-accent/[0.08] px-3 py-1 text-sm font-semibold text-accent-text">Actores IA que venden por ti</p>
              <h1 className="font-display text-[2.3rem] leading-[1.0] font-semibold sm:text-[3.1rem] lg:text-[3.7rem]">
                El mismo anuncio,<span className="chroma block">con la cara que quieras.</span>
              </h1>
              <p className="max-w-[46ch] text-lg text-muted">
                UGC, avatares y voces con tu marca. Elige el actor, pega el link de tu producto y baja decenas de anuncios listos para Meta y TikTok, en minutos.
              </p>
              <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row lg:items-start">
                <Cta sub={pack ? "Pago único, sin suscripción. Se descuenta si te suscribes en 7 días." : `Hoy no pagas nada · ${REGALO_HUMANO} · cancelas con un clic`}>{empezar}</Cta>
                <a href="#ejemplos" className="rounded-xl border border-line bg-surface/60 px-5 py-3 text-center font-semibold backdrop-blur hover:bg-surface">Ver ejemplos</a>
              </div>
              <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-sm text-muted lg:justify-start">
                {["Hasta 200 anuncios al mes", "Con tu logo y tu marca", "7 días gratis"].map((x) => <li key={x} className="flex items-center gap-1.5"><Check />{x}</li>)}
              </ul>
            </div>
            <div className="relative flex min-w-0 items-center justify-center lg:justify-end">
              <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[image:var(--grad)] opacity-25 blur-[100px]" />
              <div className="relative">
                <ActorStage clips={CARAS.slice(0, 6)} />
                <p className="mt-3 text-center text-xs text-muted">Toca una cara para cambiar el actor. Todos creados con IA.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 2 · How it works: 3 steps */}
        <section id="como" className={`scroll-mt-20 ${gutter}`} aria-labelledby="como-title">
          <div className={`${wrap} flex flex-col gap-6`}>
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 id="como-title" className={h2}>Cómo funciona</h2>
              <p className="text-muted">Lo que antes era un día de trabajo, en minutos.</p>
            </div>
            <ol className="grid gap-3 md:grid-cols-3">
              {PASOS.map((st, i) => (
                <li key={st.title} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
                  <b className="font-display text-3xl font-semibold text-transparent [-webkit-text-stroke:1px_var(--color-ink)]" aria-hidden="true">{i + 1}</b>
                  <h3 className="text-lg leading-tight font-bold">{st.title}</h3>
                  <p className="text-sm text-muted">{st.text}</p>
                </li>
              ))}
            </ol>
            <div className="self-start"><Cta sub={pack ? "Ver tus 6 ángulos no cuesta nada." : `Tu primer anuncio sale de tu ${REGALO_HUMANO}.`}>{empezar}</Cta></div>
          </div>
        </section>

        {/* 2b · Editor: UN solo video con subtítulos karaoke (palabra por palabra), estilo TikTok. Limpio y pro. */}
        <section id="editor" className={`stage relative scroll-mt-20 overflow-hidden py-14 sm:py-20 ${gutter}`} aria-labelledby="editor-title">
          <style>{`
            @keyframes creadsKw { 0%, 22%, 100% { transform: none; } 7%, 15% { color: transparent; background-image: var(--grad); -webkit-background-clip: text; background-clip: text; transform: translateY(-2px) scale(1.1); } }
            .creads-kw { display: inline-block; animation: creadsKw ${EDITOR_CAP.length * 0.42}s linear infinite; }
            @media (prefers-reduced-motion: reduce) { .creads-kw { animation: none; } }
          `}</style>
          <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[image:var(--grad)] opacity-20 blur-[120px]" />
          <div className={`${wrap} relative grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]`}>
            <div className="flex flex-col gap-4">
              <span className="w-fit rounded-full border border-accent/40 bg-accent/[0.08] px-3 py-1 text-sm font-semibold text-accent-text">Editor incluido · gratis</span>
              <h2 id="editor-title" className={h2}>Subtítulos que <span className="chroma">frenan el scroll</span></h2>
              <p className="max-w-[46ch] text-lg text-muted">Cada palabra se enciende en el momento justo, como los anuncios que más venden. Lo editas tú, sin salir de Creads: sin programas, sin saber editar.</p>
              <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
                {["Subtítulos palabra por palabra", "Tu logo y tus colores", "Música y efectos", "Zooms y destaques", "Cortes al ritmo", "Exporta 9:16 y 4:5"].map((x) => (
                  <li key={x} className="flex items-center gap-1.5 text-muted"><Check />{x}</li>
                ))}
              </ul>
              <div className="self-center sm:self-start"><Cta href="/app/editor" sub="Incluido en todos los planes.">Abre el editor</Cta></div>
            </div>
            {/* UN solo video, grande, con el subtítulo karaoke encima + chips de estilo de subtítulo */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative aspect-[9/16] w-64 overflow-hidden rounded-[2rem] border-[6px] border-[#1d1d22] bg-black shadow-[0_40px_90px_-30px_rgba(0,0,0,0.85)] sm:w-72">
                {/* Zoom anclado arriba: recorta el subtítulo quemado del clip para mostrar limpio solo el del editor. */}
                <video src={EDITOR_CLIP.src} poster={EDITOR_CLIP.poster} muted loop playsInline autoPlay preload="metadata" aria-hidden="true" className="absolute inset-0 h-full w-full origin-top scale-[1.6] object-cover" />
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-t from-black via-black/70 to-transparent" />
                <p className="caption absolute inset-x-0 bottom-[16%] flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-4 text-center text-[1.5rem] leading-tight sm:text-[1.75rem]">
                  {EDITOR_CAP.map((w, k) => (
                    <span key={`${w}-${k}`} className="creads-kw" style={{ animationDelay: `${k * 0.42}s` }}>{w}</span>
                  ))}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {["Impacto", "Limpio", "Neón", "Noticia"].map((x, i) => (
                  <span key={x} className={`rounded-full px-3 py-1 text-xs font-semibold ${i === 0 ? "bg-[image:var(--grad)] text-white" : "border border-line text-muted"}`}>{x}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3 · Real examples */}
        <section id="ejemplos" className={`scroll-mt-20 ${gutter}`} aria-labelledby="ejemplos-title">
          <div className={`${wrap} flex flex-col gap-8`}>
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 id="ejemplos-title" className={h2}>Ejemplos reales hechos con Creads</h2>
              <p className="text-muted">Nada de maquetas: todo esto salió de Creads. Y en tu cuenta tienes la galería completa de ideas para sacar más.</p>
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-bold">Imágenes para testear</h3>
              <p className="max-w-2xl text-sm text-muted">Formatos que se repiten en los anuncios que más escalan en ecommerce, afiliados, nutra y lead gen, en inglés y español. Las marcas son inventadas.</p>
              <Ejemplos />
            </div>
            <div className="flex flex-col gap-3">
              <h3 className="text-lg font-bold">Videos UGC y avatares que hablan</h3>
              <p className="max-w-2xl text-sm text-muted">Las personas no existen: las creó la IA, con voz y labios sincronizados. Imposible notar la diferencia.</p>
              {UGC_NUEVOS.length > 0 && (
                <div className="scroll-row mb-1 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:gap-4 sm:overflow-visible lg:grid-cols-6">
                  {UGC_NUEVOS.map((d) => (
                    <DemoPhone key={d.src} {...d} className="w-[52vw] max-w-[220px] shrink-0 snap-start sm:w-auto sm:max-w-none" />
                  ))}
                </div>
              )}
              <div className="scroll-row flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible lg:grid-cols-8">
                {(["dent", "doc", "cafe", "creads", "gym", "rubia", "bano", "cocina"] as const).map((k) => (
                  <DemoPhone key={k} {...DEMOS[k]} className="w-[42vw] max-w-[180px] shrink-0 snap-start sm:w-auto sm:max-w-none" />
                ))}
              </div>
            </div>
          </div>
        </section>

        {confianza.galeria.length > 0 && (
          <section className={gutter} aria-label="Hecho con Creads">
            <div className={wrap}><GaleriaCreads items={confianza.galeria} /></div>
          </section>
        )}

        {/* 5 · Plans */}
        <section id="pricing" className={`scroll-mt-20 ${gutter}`} aria-labelledby="pricing-title">
          <div className={`${wrap} flex flex-col gap-6`}>
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 id="pricing-title" className={h2}>Un saldo, lo gastas como quieras</h2>
              <p className="text-muted">Imágenes o videos, tú decides cada mes. Sin permanencia. Cancelas cuando quieras.</p>
            </div>
            <Pricing t={t.pricing} lang="es" rate={rate} renews={renews} compact pack={pack} />
            <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5 sm:p-6">
              <h3 className="font-bold">Así se gasta tu saldo</h3>
              <dl className="divide-y divide-line text-sm">
                {GASTO.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 py-2.5">
                    <dt>{k}</dt>
                    <dd className={`shrink-0 font-semibold tabular-nums ${v === "Gratis" ? "text-good" : ""}`}>{v}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs text-muted">Antes de crear siempre ves cuánto usa. Si algo no se genera, el saldo vuelve solo.</p>
            </div>
          </div>
        </section>

        {/* 6 · Guarantee */}
        <section className={gutter} aria-labelledby="garantia-title">
          <div className={`${wrap} flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 sm:p-8`}>
            <h2 id="garantia-title" className={h2}>7 días de garantía</h2>
            <p className="max-w-2xl text-muted">Calidad es lo que nos importa: cada anuncio pasa por una revisión antes de llegar a ti.</p>
            <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {[
                ["En tu plan", GARANTIA.planes],
                pack ? ["En tus primeros anuncios", GARANTIA.pack] : ["En tu prueba gratis", GARANTIA.prueba],
                ["Labios que no calzan", GARANTIA.labios],
                ["Revisión en cada pieza", "Creads revisa el texto y los detalles de cada anuncio antes de entregártelo. Si algo no se genera, el saldo vuelve solo a tu cuenta."],
              ].map(([k, v]) => (
                <li key={k} className="flex flex-col gap-1 rounded-2xl border border-good/30 bg-good/[0.06] p-4">
                  <b className="flex items-center gap-2"><Check />{k}</b>
                  <span className="text-sm text-muted">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {confianza.testimonios.length > 0 && (
          <section className={gutter} aria-labelledby="testimonios-title">
            <div className={`${wrap} flex flex-col gap-6`}>
              <h2 id="testimonios-title" className={h2}>Lo que dicen quienes ya testean con Creads</h2>
              <ul className="grid gap-4 md:grid-cols-3">
                {confianza.testimonios.slice(0, 6).map((x) => (
                  <li key={x.nombre + x.texto.slice(0, 20)} className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed link from private storage */}
                    {x.imagen && <img src={x.imagen} alt={`Captura compartida por ${x.nombre}`} className="w-full rounded-xl border border-line" loading="lazy" />}
                    <blockquote className="text-[15px]">«{x.texto}»</blockquote>
                    <p className="text-sm"><b>{x.nombre}</b> <span className="text-muted">· {x.rubro}</span></p>
                    {x.beneficio && <p className="text-xs text-muted">Recibió {x.beneficio} por compartir su experiencia.</p>}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* 7 · Founder: Benjamín (owner, 25 Oct 2026: Gastón prefers not to appear). Photo: /public/fundador.jpg */}
        <section className={gutter} aria-labelledby="fundador-title">
          <div className={`${wrap} grid gap-6 rounded-3xl border border-line bg-surface p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center`}>
            {FOTO_FUNDADOR
              ? <Image src="/fundador.jpg" alt="Benjamín, fundador de Creads" width={112} height={112} className="h-28 w-28 rounded-full object-cover" />
              : <div className="grid h-28 w-28 place-items-center rounded-full bg-[image:var(--grad)] font-display text-4xl font-semibold text-white" aria-hidden="true">B</div>}
            <div className="flex flex-col gap-3">
              <h2 id="fundador-title" className="font-display text-2xl font-semibold">Por qué hicimos Creads</h2>
              <p className="max-w-3xl text-muted">
                Soy Benjamín. Junto a mi equipo compramos medios en Meta todos los días y siempre chocábamos con lo mismo: el anuncio que funciona se cansa rápido y hacer ángulos nuevos a mano, con agencia o saltando entre herramientas tomaba demasiado. Hicimos Creads para resolver eso, y lo usamos en nuestras propias campañas.
              </p>
              <p className="text-sm text-muted">¿Preguntas? Escríbenos a hola@creadsia.com.</p>
            </div>
          </div>
        </section>

        {/* 8 · Questions */}
        <section id="preguntas" className={`scroll-mt-20 ${gutter}`} aria-labelledby="faq-title">
          <div className={`${wrap} grid gap-6 lg:grid-cols-[0.7fr_1.3fr]`}>
            <h2 id="faq-title" className={h2}>Preguntas frecuentes</h2>
            <div className="flex flex-col divide-y divide-line border-y border-line">
              {FAQ.map(([q, a]) => (
                <details key={q} className="group py-1">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-2 font-semibold">{q}<span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-45">+</span></summary>
                  <p className="pt-2 text-muted"><MoneyText text={a} rate={rate} /></p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 9 · Last call */}
        <section className={gutter}>
          <div className={`${wrap} relative grid items-center gap-8 overflow-hidden rounded-[2rem] border border-line bg-surface px-6 py-10 sm:px-10 md:grid-cols-[1.3fr_0.7fr]`}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-20 blur-[90px]" style={{ background: "var(--grad)" }} />
            <div className="relative flex min-w-0 flex-col items-start gap-4">
              <h2 className="font-display text-[1.8rem] leading-tight font-semibold sm:text-4xl">Tus próximos anuncios pueden estar corriendo hoy.</h2>
              <p className="text-muted">Pega el link de tu producto, elige tus ángulos y descarga 10 anuncios listos para Meta.</p>
              <Cta sub={pack ? undefined : "Hoy no pagas nada. Cancelas cuando quieras."}>{empezar}</Cta>
              <InsigniasPago compact />
              <SoporteLinea />
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
        <nav aria-labelledby="footer-herramientas" className={`${wrap} flex flex-wrap items-center gap-x-4 pt-8 text-sm text-muted [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center`}>
          <span id="footer-herramientas" className="font-semibold text-ink">Herramientas gratis</span>
          <a href="/generador-de-hooks" className="hover:text-ink">Generador de hooks</a>
          <a href="/plantilla-meta" className="hover:text-ink">Plantilla para Meta Ads</a>
        </nav>
        <div className={`${wrap} flex flex-col gap-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between`}>
          <span>© {new Date().getFullYear()} Creads IA · Chile · <a href="mailto:hola@creadsia.com" className="inline-flex min-h-11 items-center hover:text-ink">hola@creadsia.com</a></span>
          <span className="flex flex-wrap gap-x-4 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center">
            {confianza.novedades.length > 0 && <a href="/novedades" className="hover:text-ink">Novedades</a>}
            {confianza.roadmap && <a href="/roadmap" className="hover:text-ink">Roadmap</a>}
            <a href="/afiliados" className="hover:text-ink">Programa de afiliados</a>
            <a href="/en" className="hover:text-ink" hrefLang="en" lang="en">English</a>
            <a href="/terminos" className="hover:text-ink">Términos y condiciones</a>
            <a href="/privacidad" className="hover:text-ink">Política de privacidad</a>
            <a href="/terminos#garantia" className="hover:text-ink">Política de reembolso</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
