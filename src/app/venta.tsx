import Image from "next/image";
import { existsSync } from "node:fs";
import path from "node:path";
import type { Content } from "@/content/en";
import { FUNDADOR, PRUEBA, SHOWN_PLANS, usd } from "@/lib/catalog";
import { Logo } from "./brand";
import Pricing from "./pricing";
import ThemeToggle from "./theme-toggle";
import FunnelNudges from "./funnel-nudges";
import WhatsAppButton from "./whatsapp";
import DemoPhone from "./demo-phone";
import { Money, MoneyText } from "./money";
import Ejemplos from "./ejemplos";
import Muro from "./muro";

// The home page (owner's plan, 25 Oct 2026). Main audience: people who already spend on Meta ads (ecommerce,
// affiliates and media buyers, info-product sellers); small businesses come second. One promise: test many
// ads a month, not three. Order asked by the owner: hero with the promise and a 2-minute demo → how it works in
// 3 steps → real examples → comparison → plans → guarantee → founder → questions → last call.
// Everything shown as an example is a real Creads output: the videos in /public/demos (21 Oct 2026) and the
// images in /public/ejemplos (made with Creads on 25 Oct 2026: invented brands; see src/lib/ideas.ts).

const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";
const wrap = "mx-auto w-full max-w-6xl";
const h2 = "font-display text-[1.7rem] leading-[1.1] font-semibold sm:text-[2.3rem]";

/** Sign-up, then the first batch (paid with the Pack Prueba). */
const START = "/registro";
const cheapest = [...SHOWN_PLANS].sort((a, b) => a.monthly - b.monthly)[0];

/** The founder's photo, when it's in /public (owner, 25 Oct 2026). */
const FOTO_FUNDADOR = existsSync(path.join(process.cwd(), "public", "fundador.jpg"));
/** The 2-minute demo with sound (recorded by the owner): set NEXT_PUBLIC_DEMO_VIDEO in Vercel. */
const DEMO_VIDEO = process.env.NEXT_PUBLIC_DEMO_VIDEO ?? "";

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

// Product videos made with «Video de producto» (photo of the product → scene → 6 s motion), no text on top.
const PRODUCTO_DEMOS = [
  { src: "/demos/prod-blendgo.mp4", poster: "/demos/prod-blendgo.jpg", label: "Licuadora portátil" },
  { src: "/demos/prod-serum.mp4", poster: "/demos/prod-serum.jpg", label: "Sérum" },
  { src: "/demos/prod-cafe.mp4", poster: "/demos/prod-cafe.jpg", label: "Café" },
  { src: "/demos/prod-audifonos.mp4", poster: "/demos/prod-audifonos.jpg", label: "Audífonos" },
  { src: "/demos/prod-celular.mp4", poster: "/demos/prod-celular.jpg", label: "Celular" },
  { src: "/demos/prod-zapatillas.mp4", poster: "/demos/prod-zapatillas.jpg", label: "Zapatillas" },
  { src: "/demos/prod-perfume.mp4", poster: "/demos/prod-perfume.jpg", label: "Perfume" },
];
/** The product reel: several product videos cut fast, to the beat. */
const REEL = { src: "/demos/reel-producto.mp4", poster: "/demos/reel-producto.jpg", label: "Videos de producto hechos con Creads" };
const HAY_REEL = existsSync(path.join(process.cwd(), "public", "demos", "reel-producto.mp4"));
/** The wall under the hero: only clean product videos. */
const MURO_VIDEOS = [PRODUCTO_DEMOS[4], PRODUCTO_DEMOS[0], PRODUCTO_DEMOS[5], PRODUCTO_DEMOS[1], PRODUCTO_DEMOS[3], PRODUCTO_DEMOS[6], PRODUCTO_DEMOS[2]];

const PASOS = [
  { title: "Pega el link de tu producto", text: "Creads lee tu página: qué vendes, a quién, el precio y la foto del producto. Si no tienes página, lo describes en dos frases." },
  { title: "Elige tus ángulos de venta", text: "Te propone 6: dolor, deseo, mecanismo, prueba social, creencia y oferta. Marcas los que quieres testear." },
  { title: "Descarga tu tanda", text: "10 anuncios en 4:5 para el feed y 9:16 para stories y reels, con tu marca, en un ZIP ordenado y con el archivo para importarlos en Meta." },
] as const;

const FAQ = [
  ["¿Puedo probar antes de suscribirme?", `Sí, con el Pack Prueba: un pago único de US$${PRUEBA.usd}, sin suscripción, que alcanza para tu primera tanda (hasta 12 imágenes o 1 video con avatar). Crear la cuenta y ver los 6 ángulos de venta para tu producto no cuesta nada. Si te suscribes dentro de 7 días, los US$${PRUEBA.usd} se descuentan de tu primer mes.`],
  ["¿Necesito tarjeta para crear la cuenta?", "No. La cuenta se crea con tu correo o con Google. Solo pagas cuando compras el Pack Prueba o un plan, en la ventana segura de Mercado Pago."],
  ["¿Cómo funciona el saldo?", "Cada plan trae un saldo al mes que gastas en imágenes o videos, como quieras: por ejemplo, Escala alcanza para hasta 95 imágenes o 7 videos con avatar de 10 s, o una mezcla. Antes de crear siempre ves cuánto usa. Si algo falla, el saldo vuelve solo."],
  ["¿Para qué tipo de negocio sirve?", "Para quien ya invierte en anuncios de Meta y necesita testear ángulos nuevos todo el tiempo: tiendas online, afiliados y media buyers, infoproductos. También para pymes que quieren anuncios propios sin agencia."],
  ["¿En qué idioma salen los anuncios?", "En español o en inglés, tú eliges en cada tanda. Los videos pueden tener voz con acento chileno, argentino, colombiano, venezolano o mexicano, o en inglés."],
  ["¿Qué pasa si mi primera tanda no me sirve?", "Escríbenos a hola@creadsia.com dentro de 10 días: la rehacemos o te devolvemos el pago."],
  ["¿Cómo pago?", "Con tarjeta de crédito, débito o saldo de Mercado Pago. En Chile pagas en pesos al cambio del día. Creads nunca ve tu tarjeta y el comprobante te llega al correo."],
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

export default function Venta({ t, rate = 950, renews = true }: { t: Content; rate?: number; renews?: boolean }) {
  const pack = <Money usd={PRUEBA.usd} rate={rate} />;
  return (
    <div className="overflow-x-clip pb-20 lg:pb-0">
      <FunnelNudges t={t.nudge} lang={t.lang} rate={rate} />
      <WhatsAppButton />

      <header className="sticky top-[env(safe-area-inset-top,0px)] z-30 border-b border-line/60 bg-bg/85 backdrop-blur">
        <div className={`${wrap} flex items-center justify-between gap-3 py-3 ${gutter}`}>
          <Logo href="/" />
          <nav aria-label="Secciones" className="hidden items-center gap-1 text-[15px] md:flex">
            {[["#como", "Cómo funciona"], ["#ejemplos", "Ejemplos"], ["#pricing", "Planes"], ["#preguntas", "Preguntas"]].map(([h, l]) => (
              <a key={h} href={h} className="rounded-lg px-3 py-2 text-muted hover:bg-surface hover:text-ink">{l}</a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <a href="/en" className="hidden px-2 text-sm font-semibold text-muted hover:text-ink min-[420px]:inline" hrefLang="en" lang="en">English</a>
            <span className="hidden min-[420px]:contents"><ThemeToggle lang="es" /></span>
            <a href="/app" className="px-2 text-sm font-semibold text-muted hover:text-ink">Entrar</a>
            <a href={START} className="whitespace-nowrap rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-bg hover:opacity-90 sm:px-4">Empezar</a>
          </div>
        </div>
      </header>

      <main className="flex flex-col gap-16 pb-16 sm:gap-24">
        {/* 1 · Hero: the promise, the button and the demo */}
        <section className={`stage relative -mt-px overflow-hidden ${gutter}`}>
          <div className={`${wrap} relative grid items-center gap-10 py-10 sm:py-14 lg:grid-cols-[1.05fr_0.95fr]`}>
            <div className="flex min-w-0 flex-col gap-5">
              <p className="w-fit rounded-full border border-line bg-surface/70 px-3 py-1 text-sm text-muted backdrop-blur">El anuncio que vende se quema en días. Gana el que testea más rápido.</p>
              <h1 className="font-display text-[2.5rem] leading-[1.02] font-semibold sm:text-[3.8rem]">
                Testea 70 anuncios al mes. <span className="chroma">No 3.</span>
              </h1>
              <p className="max-w-[52ch] text-lg text-muted">
                Imágenes, videos UGC y avatares que hablan, en español o inglés, con tu marca y listos para subir a Meta.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Cta sub="Pago único, sin suscripción. Se descuenta si te suscribes en 7 días.">Haz tu primera tanda por {pack}</Cta>
                <a href="#como" className="rounded-xl border border-line bg-surface/60 px-5 py-3 text-center font-semibold backdrop-blur hover:bg-surface">Ver cómo funciona</a>
              </div>
              <ul className="grid gap-1.5 text-sm text-muted sm:grid-cols-2">
                {["6 ángulos de venta desde el link de tu producto", "Feed 4:5 y stories 9:16, con tu logo", "Garantía en tu primera tanda", `Planes desde ${usd(cheapest.monthly)} al mes`].map((x) => <li key={x} className="flex items-center gap-1.5"><Check /><MoneyText text={x} rate={rate} /></li>)}
              </ul>
            </div>

            <div className="flex min-w-0 flex-col items-center gap-3">
              {DEMO_VIDEO ? (
                <figure className="flex w-full flex-col gap-2">
                  <video src={DEMO_VIDEO} controls playsInline preload="metadata" className="aspect-video w-full rounded-3xl border border-line bg-black" aria-label="Demo de Creads (2 minutos)" />
                  <figcaption className="text-center text-sm text-muted">Demo de 2 minutos, con sonido: de un link a 10 anuncios.</figcaption>
                </figure>
              ) : (
                <div className="relative flex w-full justify-center py-4">
                  <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[image:var(--grad)] opacity-30 blur-[110px]" />
                  <DemoPhone {...(HAY_REEL ? REEL : PRODUCTO_DEMOS[0])} big className="relative w-60 sm:w-72" />
                </div>
              )}
            </div>
          </div>
          {/* the wall: clean product videos moving */}
          <div className="relative -mx-[max(16px,env(safe-area-inset-left,0px))] pb-12 sm:pb-16">
            <Muro videos={MURO_VIDEOS} />
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
            <div className="self-start"><Cta sub="Ver tus 6 ángulos no cuesta nada.">Haz tu primera tanda por {pack}</Cta></div>
          </div>
        </section>

        {/* 2b · Product videos: three of them side by side, the style under each */}
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
              <div className="self-start"><Cta href="/app/video-producto" sub="Usa el mismo saldo de tu plan.">Haz el video de tu producto</Cta></div>
            </div>
            <div className="grid grid-cols-3 items-center gap-3 sm:gap-5">
              {([[PRODUCTO_DEMOS[4], "Salpicadura"], [PRODUCTO_DEMOS[3], "Flotando"], [PRODUCTO_DEMOS[6], "Salpicadura"]] as const).map(([d, estilo], i) => (
                <div key={d.src} className={i === 1 ? "-mt-10" : "mt-10"}>
                  <DemoPhone {...d} label={`${d.label} · ${estilo}`} big={i === 1} />
                </div>
              ))}
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
              <p className="max-w-2xl text-sm text-muted">Las personas no existen: las creó la IA, con voz y labios sincronizados.</p>
              <div className="scroll-row flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-4 sm:gap-4 sm:overflow-visible lg:grid-cols-8">
                {(["dent", "doc", "cafe", "creads", "gym", "rubia", "bano", "cocina"] as const).map((k) => (
                  <DemoPhone key={k} {...DEMOS[k]} className="w-[42vw] max-w-[180px] shrink-0 snap-start sm:w-auto sm:max-w-none" />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4 · Comparison */}
        <section className={gutter} aria-labelledby="compara-title">
          <div className={`${wrap} flex flex-col gap-6`}>
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 id="compara-title" className={h2}>10 anuncios para testear, cuatro caminos</h2>
              <p className="text-muted">Para encontrar un anuncio ganador necesitas probar muchos. Así se compara cada forma de hacerlos.</p>
            </div>
            <div className="overflow-x-auto rounded-3xl border border-line">
              <table className="w-full min-w-[640px] text-left text-sm sm:text-[15px]">
                <thead>
                  <tr className="bg-surface-2 text-xs sm:text-sm">
                    <th scope="col" className="p-3 sm:p-4"><span className="sr-only">Comparación</span></th>
                    <th scope="col" className="p-3 font-semibold text-muted sm:p-4">A mano</th>
                    <th scope="col" className="p-3 font-semibold text-muted sm:p-4">Agencia</th>
                    <th scope="col" className="p-3 font-semibold text-muted sm:p-4">Canva o ChatGPT</th>
                    <th scope="col" className="bg-ink p-3 font-semibold text-bg sm:p-4">Creads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line bg-surface">
                  {[
                    ["Tiempo", "Uno o dos días", "Días o semanas", "Horas de prueba y error", "Minutos"],
                    ["Ángulos de venta", "Los que se te ocurran", "Los del brief", "Tienes que pedirlos tú", "6 propuestos desde tu página"],
                    ["Feed y stories", "Rehacer cada tamaño", "Según lo que contrates", "Ajustar a mano", "4:5 y 9:16 de una vez"],
                    ["Videos con persona", "Grabarte tú", "Actores o creadores", "No", "Avatares que hablan"],
                    ["Tu marca", "Tú la aplicas", "Sí", "Tú la aplicas", "Kit de marca en todo"],
                    ["Costo", "Tu tiempo", "Se cobra cada pieza", "Suscripción + tu tiempo", `Desde ${usd(cheapest.monthly)} al mes`],
                  ].map(([k, ...v]) => (
                    <tr key={k}>
                      <th scope="row" className="p-3 font-semibold sm:p-4">{k}</th>
                      {v.slice(0, 3).map((x, i) => <td key={i} className="p-3 text-muted sm:p-4">{x}</td>)}
                      <td className="p-3 font-semibold sm:p-4"><span className="flex items-start gap-1.5"><Check className="mt-0.5 text-good" /><MoneyText text={v[3]} rate={rate} /></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 5 · Plans */}
        <section id="pricing" className={`scroll-mt-20 ${gutter}`} aria-labelledby="pricing-title">
          <div className={`${wrap} flex flex-col gap-6`}>
            <div className="flex max-w-2xl flex-col gap-2">
              <h2 id="pricing-title" className={h2}>Un saldo, lo gastas como quieras</h2>
              <p className="text-muted">Imágenes o videos, tú decides cada mes. Sin permanencia. Escala a <Money usd={FUNDADOR.usd} rate={rate} /> los primeros {FUNDADOR.months} meses para los primeros {FUNDADOR.cupos} clientes.</p>
            </div>
            <Pricing t={t.pricing} lang="es" rate={rate} renews={renews} compact />
          </div>
        </section>

        {/* 6 · Guarantee */}
        <section className={gutter} aria-labelledby="garantia-title">
          <div className={`${wrap} flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6 sm:p-8`}>
            <h2 id="garantia-title" className={h2}>Tu primera tanda, garantizada</h2>
            <p className="max-w-2xl text-muted">Calidad es lo que nos importa: cada anuncio pasa por una revisión antes de llegar a ti.</p>
            <ul className="grid gap-3 md:grid-cols-3">
              {[
                ["La rehacemos o te devolvemos el pago", "Si tu primera tanda no te sirve, escríbenos a hola@creadsia.com dentro de 10 días y eliges."],
                ["Revisión en cada imagen", "Creads revisa el texto y los detalles de cada anuncio y te avisa si algo no quedó bien."],
                ["Si algo falla, no pagas", "Si una imagen o un video no se genera, el saldo vuelve solo a tu cuenta."],
              ].map(([k, v]) => (
                <li key={k} className="flex flex-col gap-1 rounded-2xl border border-good/30 bg-good/[0.06] p-4">
                  <b className="flex items-center gap-2"><Check />{k}</b>
                  <span className="text-sm text-muted">{v}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

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
                <details key={q} className="group py-3.5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">{q}<span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-45">+</span></summary>
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
            <div className="relative flex flex-col items-start gap-4">
              <h2 className="font-display text-[1.8rem] leading-tight font-semibold sm:text-4xl">Tu próxima tanda puede estar corriendo hoy.</h2>
              <p className="text-muted">Pega el link de tu producto, elige tus ángulos y descarga 10 anuncios listos para Meta.</p>
              <Cta>Haz tu primera tanda por {pack}</Cta>
            </div>
            <div className="relative mx-auto flex items-end">
              <DemoPhone {...DEMOS.bano} className="relative z-0 -mr-6 w-32 -rotate-6 sm:w-36" />
              <DemoPhone {...DEMOS.creads} className="relative z-10 w-40 sm:w-44" />
              <DemoPhone {...DEMOS.cocina} className="relative z-0 -ml-6 w-32 rotate-6 sm:w-36" />
            </div>
          </div>
        </section>
      </main>

      <footer className={`border-t border-line ${gutter}`}>
        <nav aria-labelledby="footer-herramientas" className={`${wrap} flex flex-wrap items-center gap-x-4 gap-y-2 pt-8 text-sm text-muted`}>
          <span id="footer-herramientas" className="font-semibold text-ink">Herramientas gratis</span>
          <a href="/generador-de-hooks" className="hover:text-ink">Generador de hooks</a>
          <a href="/plantilla-meta" className="hover:text-ink">Plantilla para Meta Ads</a>
        </nav>
        <div className={`${wrap} flex flex-col gap-4 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between`}>
          <span>© {new Date().getFullYear()} Creads IA · hola@creadsia.com</span>
          <span className="flex flex-wrap gap-4">
            <a href="/afiliados" className="hover:text-ink">Programa de afiliados</a>
            <a href="/en" className="hover:text-ink" hrefLang="en" lang="en">English</a>
            <a href="/terminos" className="hover:text-ink">Términos y condiciones</a>
            <a href="/privacidad" className="hover:text-ink">Política de privacidad</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
