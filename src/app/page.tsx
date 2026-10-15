import Image from "next/image";
import { Logo, Mark } from "./brand";
import Composer from "./composer";
import WaitlistForm from "./waitlist-form";

const CDN = "https://d8j0ntlcm91z4.cloudfront.net/user_3DdKYHg29Dc6YLtguhB32IBiQZ7/hf_20261015_220556_";
const img = (id: string) => `${CDN}${id}.png`;

// Scenes generated with the models Creads uses. w/h = real pixel size (9:16 or 4:5).
const SCENES = {
  ugc: { src: img("0c908a12-e315-4bc9-b0b9-f2e30ce41a32"), w: 1536, h: 2752, alt: "Mujer hablando a cámara en su cocina, estilo UGC" },
  podcast: { src: img("6dd2acd7-4699-4665-b27b-a4f1cdc87267"), w: 1856, h: 2304, alt: "Dos personas grabando un podcast en un estudio cálido" },
  serum: { src: img("648442ce-d231-4608-9ee3-6e421dc462e7"), w: 1856, h: 2304, alt: "Frasco de sérum sobre piedra mojada con luz de mañana" },
  valpo: { src: img("638f557e-139c-4ebe-a0dc-b91d0f5adb64"), w: 1536, h: 2752, alt: "Creadora grabándose en una terraza de Valparaíso al atardecer" },
  coach: { src: img("454a7b5b-f21a-4097-8205-2bfafe2e9489"), w: 1536, h: 2752, alt: "Entrenador grabando un reel en el gimnasio" },
  chef: { src: img("db507db9-6f46-4813-a3a9-076767d0545d"), w: 1856, h: 2304, alt: "Chef emplatando un ceviche" },
  realtor: { src: img("829d052f-a160-420e-86e4-ac469d9f5b65"), w: 1536, h: 2752, alt: "Corredora grabando el recorrido de una propiedad" },
  car: { src: img("8a59f674-4577-4a57-a01e-c6c0f60290b2"), w: 1536, h: 2752, alt: "Hombre hablando a cámara desde su auto en la fila de un drive-thru" },
  sneaker: { src: img("3975c800-9d1b-4133-aefd-c01a2a1e1cd6"), w: 1856, h: 2304, alt: "Zapatilla blanca flotando entre polvo de colores" },
  news: { src: img("4201ea1f-ac6c-48db-9c04-d0d4385b6468"), w: 1536, h: 2752, alt: "Presentadora en un set de noticias" },
};
type SceneKey = keyof typeof SCENES;

const wall: { k: SceneKey; label: string; model: string }[] /* model = format line under each tile */ = [
  { k: "ugc", label: "Anuncio UGC", model: "9:16 · con tu voz clonada" },
  { k: "serum", label: "Foto de producto", model: "4:5 · para el feed" },
  { k: "valpo", label: "Reel de viaje", model: "9:16 · Reels y TikTok" },
  { k: "podcast", label: "Podcast con dos voces", model: "4:5 · video podcast" },
  { k: "coach", label: "Reel de entrenamiento", model: "9:16 · creador fitness" },
  { k: "chef", label: "Contenido para restaurante", model: "4:5 · negocio local" },
  { k: "car", label: "Testimonio drive-thru", model: "9:16 · lead-gen en EE. UU." },
  { k: "sneaker", label: "Hero de e-commerce", model: "4:5 · tienda online" },
  { k: "realtor", label: "Recorrido de propiedad", model: "9:16 · inmobiliaria" },
  { k: "news", label: "Formato noticiero", model: "9:16 · agencia" },
];

const studios: { name: string; does: string; k?: SceneKey }[] = [
  { name: "Anuncios UGC", does: "Una persona contando su experiencia a cámara, con la misma cara, ropa y lugar en cada corte.", k: "ugc" },
  { name: "Reels y TikToks", does: "Videos verticales para creadores e influencers, con subtítulos estilo reel incluidos.", k: "valpo" },
  { name: "Podcast IA", does: "Dos voces conversando: una cuenta la historia y la otra cierra con tu mensaje.", k: "podcast" },
  { name: "Fotos de producto", does: "Imágenes de catálogo y de feed en 4:5, con revisión de ortografía en cada texto.", k: "serum" },
  { name: "Tu cara como avatar", does: "Sube unos segundos de video y aparece en tus contenidos sin grabar, con tu autorización." },
  { name: "Tu voz clonada", does: "Tu voz o la de tu equipo leyendo cualquier guion, en español o en inglés." },
  { name: "Guiones que venden", does: "Biblioteca de guiones por nicho y búsqueda de anuncios que ya están funcionando." },
  { name: "Producción automática", does: "Pegas un guion y recibes 3 versiones terminadas con distintos ganchos." },
];

const compare: [string, string, string][] = [
  ["Quién escribe el guion y las escenas", "Tú", "Creads, a partir de tu idea"],
  ["Misma persona, ropa y lugar en todo el video", "Depende de la suerte", "Revisado corte por corte"],
  ["Que diga exactamente tu guion", "Lo revisas tú", "Lo escucha y compara palabra por palabra"],
  ["Ortografía en imágenes con texto", "Lo revisas tú", "Revisión automática antes de entregar"],
  ["Armado, cortes y subtítulos", "En otra aplicación", "Incluido, listo para publicar"],
  ["Aprende de tus correcciones", "No", "Cada corrección se vuelve una regla"],
];

const models: [string, string, string][] = [
  ["Veo 3.1", "Google", "Video realista con voz y sonido en la misma toma"],
  ["Seedance 2.0", "ByteDance", "Personajes consistentes y escenas con referencias"],
  ["Kling 3.0", "Kuaishou", "Movimiento y acción con física creíble"],
  ["Nano Banana Pro", "Google", "Imágenes con texto legible y fotos de producto"],
  ["ElevenLabs", "ElevenLabs", "Voces clonadas y lectura natural"],
  ["Claude", "Anthropic", "Guiones, dirección de escenas y revisión de calidad"],
];

const audiences: [string, string][] = [
  ["Creadores e influencers", "Publica todos los días sin grabar todos los días."],
  ["Marketers y agencias", "Prueba más ángulos y ganchos por cliente, con menos producción."],
  ["Marcas y e-commerce", "Fotos de producto, anuncios y reels con la identidad de tu marca."],
  ["Negocios locales", "Restaurantes, inmobiliarias, gimnasios y clínicas con contenido propio cada semana."],
  ["Afiliados y lead-gen", "Formatos probados con presupuesto real en seguros, remodelación y servicios."],
];

const faqs = [
  {
    q: "¿Necesito saber editar o escribir prompts?",
    a: "No. Escribes lo que quieres en tus palabras. Creads escribe el guion, las escenas y las instrucciones para cada modelo, y te entrega el contenido armado.",
  },
  {
    q: "¿En qué idiomas puedo crear?",
    a: "La plataforma está en español. Los videos pueden hablar en inglés de Estados Unidos o en español con acento chileno, y vamos sumando más acentos.",
  },
  {
    q: "¿Puedo usar mi propia cara o voz?",
    a: "Sí, con tu autorización. También puedes usar avatares creados con IA. Nunca usamos la cara o la voz de una persona sin su consentimiento.",
  },
  {
    q: "¿Quién es dueño del contenido?",
    a: "Tú. Lo que creas en Creads lo puedes publicar y usar en tus campañas y en las de tus clientes.",
  },
  {
    q: "¿Cuánto cuesta?",
    a: "Planes mensuales con créditos incluidos. Los fundadores conocen el precio primero y lo mantienen mientras sigan suscritos.",
  },
];

function SectionHead({ id, title, lead }: { id: string; title: string; lead?: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <h2 id={id} className="text-[2rem] font-extrabold sm:text-[2.6rem]">
        {title}
      </h2>
      {lead && <p className="text-lg text-muted">{lead}</p>}
    </div>
  );
}

export default function Home() {
  return (
    <div className="overflow-x-clip">
      {/* Header */}
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-20 border-b border-line/60 bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-[max(16px,env(safe-area-inset-left,0px))] py-3.5">
          <Logo />
          <nav aria-label="Secciones" className="hidden items-center gap-7 text-[15px] text-muted md:flex">
            <a href="#estudios" className="hover:text-ink">Estudios</a>
            <a href="#diferencia" className="hover:text-ink">Cómo funciona</a>
            <a href="#modelos" className="hover:text-ink">Modelos</a>
            <a href="#para-quien" className="hover:text-ink">Para quién</a>
          </nav>
          <a
            href="#fundadores"
            className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
          >
            Entrar a la beta
          </a>
        </div>
      </header>

      <main id="inicio" className="flex flex-col gap-32 pb-24">
        {/* Hero */}
        <section className="relative px-[max(16px,env(safe-area-inset-left,0px))] pt-16 sm:pt-24">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-[520px] max-w-5xl rounded-full opacity-40 blur-[120px]"
            style={{ background: "var(--grad)" }}
          />
          <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-8 text-center">
            <a
              href="#fundadores"
              className="flex items-center gap-2 rounded-full border border-line bg-surface/70 px-3.5 py-1.5 text-sm text-muted backdrop-blur hover:text-ink"
            >
              <span className="h-2 w-2 rounded-full bg-rec" aria-hidden="true" />
              Beta de fundadores abierta: 50 cupos
            </a>
            <h1 className="text-[2.9rem] font-black leading-[1.02] [font-stretch:118%] sm:text-7xl">
              Escribe la idea. Recibe el contenido terminado.
            </h1>
            <p className="max-w-[60ch] text-lg text-muted sm:text-xl">
              Creads es el estudio de IA en español para crear anuncios, reels, podcasts y fotos de producto. Escribe
              el guion, dirige cada escena con los mejores modelos del mundo y revisa todo antes de entregártelo.
            </p>
            <Composer />
          </div>
        </section>

        {/* Showcase wall */}
        <section aria-labelledby="muro" className="px-[max(16px,env(safe-area-inset-left,0px))]">
          <h2 id="muro" className="sr-only">
            Ejemplos de escenas
          </h2>
          <div className="mx-auto max-w-7xl columns-2 gap-3 sm:columns-3 lg:columns-5">
            {wall.map(({ k, label, model }) => {
              const s = SCENES[k];
              return (
                <figure key={k} className="group relative mb-3 break-inside-avoid overflow-hidden rounded-2xl bg-surface-2">
                  <Image
                    src={s.src}
                    alt={s.alt}
                    width={s.w}
                    height={s.h}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                    className="h-auto w-full transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 text-left text-white">
                    <span className="block text-sm font-semibold">{label}</span>
                    <span className="block text-xs opacity-75">{model}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
          <p className="mx-auto mt-4 max-w-7xl text-sm text-muted">
            Imágenes generadas con IA para este sitio. Ninguna de estas personas existe.
          </p>
        </section>

        {/* Studios */}
        <section aria-labelledby="estudios" className="scroll-mt-24 px-[max(16px,env(safe-area-inset-left,0px))]">
          <div className="mx-auto flex max-w-7xl flex-col gap-10">
            <SectionHead
              id="estudios"
              title="Un estudio para cada tipo de contenido"
              lead="Cada estudio sabe cómo se graba ese formato: cuántos cortes lleva, cómo se mueve la cámara y quién habla."
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {studios
                .filter((s) => s.k)
                .map((s) => {
                  const sc = SCENES[s.k as SceneKey];
                  return (
                    <article key={s.name} className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
                      <div className="relative aspect-[4/5] overflow-hidden">
                        <Image
                          src={sc.src}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5 p-4">
                        <h3 className="text-lg font-bold [font-stretch:100%]">{s.name}</h3>
                        <p className="text-[15px] leading-relaxed text-muted">{s.does}</p>
                      </div>
                    </article>
                  );
                })}
            </div>
            <dl className="grid gap-x-8 gap-y-6 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-4">
              {studios
                .filter((s) => !s.k)
                .map((s) => (
                  <div key={s.name} className="flex flex-col gap-1.5">
                    <dt className="font-display text-lg font-bold [font-stretch:100%]">{s.name}</dt>
                    <dd className="text-[15px] leading-relaxed text-muted">{s.does}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </section>

        {/* The difference: directing included */}
        <section aria-labelledby="diferencia" className="scroll-mt-24 px-[max(16px,env(safe-area-inset-left,0px))]">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="flex flex-col gap-6">
              <SectionHead
                id="diferencia"
                title="Otras herramientas te dan clips. Creads te entrega contenido terminado."
                lead="Generar un video es fácil. Lo difícil es que la misma persona aparezca en todas las escenas, que diga exactamente lo que escribiste y que el resultado se vea grabado, no generado."
              />
              <ol className="flex flex-col gap-4">
                {[
                  ["Escribe", "Tu idea se convierte en guion y escenas de hasta 8 segundos."],
                  ["Genera", "Cada escena sale del modelo que mejor la resuelve."],
                  ["Revisa", "Escucha, mira y compara contra el guion; rehace solo lo que salió mal."],
                  ["Arma", "Une, recorta silencios y pone subtítulos. Listo para publicar."],
                ].map(([t, d], i) => (
                  <li key={t} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line font-display text-sm font-bold">
                      {i + 1}
                    </span>
                    <span>
                      <b className="font-semibold">{t}.</b> <span className="text-muted">{d}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="min-w-0 overflow-x-auto rounded-2xl border border-line bg-surface">
              <table className="w-full min-w-[560px] text-left text-[15px]">
                <caption className="sr-only">Comparación entre un generador de IA típico y Creads</caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="p-4 font-medium text-muted"></th>
                    <th scope="col" className="p-4 font-medium text-muted">Generador de IA típico</th>
                    <th scope="col" className="p-4">
                      <span className="flex items-center gap-2 font-bold">
                        <Mark size={20} /> Creads
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map(([row, other, ours]) => (
                    <tr key={row} className="border-b border-line last:border-0">
                      <th scope="row" className="p-4 font-medium">{row}</th>
                      <td className="p-4 text-muted">{other}</td>
                      <td className="p-4">{ours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Models */}
        <section aria-labelledby="modelos" className="scroll-mt-24 px-[max(16px,env(safe-area-inset-left,0px))]">
          <div className="mx-auto flex max-w-7xl flex-col gap-10">
            <SectionHead
              id="modelos"
              title="Los mejores modelos del mundo, elegidos escena por escena"
              lead="No tienes que saber cuál usar. Creads elige el modelo según lo que pide cada escena, y tú puedes cambiarlo cuando quieras."
            />
            <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
              {models.map(([name, maker, use]) => (
                <div key={name} className="flex flex-col gap-1 bg-surface p-5">
                  <span className="flex items-baseline justify-between gap-3">
                    <b className="font-display text-xl font-extrabold [font-stretch:100%]">{name}</b>
                    <span className="text-sm text-muted">{maker}</span>
                  </span>
                  <span className="text-[15px] text-muted">{use}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Audiences + Spanish-first */}
        <section aria-labelledby="para-quien" className="scroll-mt-24 px-[max(16px,env(safe-area-inset-left,0px))]">
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-2">
            <div className="flex flex-col gap-8">
              <SectionHead id="para-quien" title="Para cualquiera que viva de su contenido" />
              <dl className="divide-y divide-line border-y border-line">
                {audiences.map(([who, why]) => (
                  <div key={who} className="grid gap-1 py-4 sm:grid-cols-[13rem_1fr] sm:gap-6">
                    <dt className="font-semibold">{who}</dt>
                    <dd className="text-muted">{why}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="relative flex flex-col justify-end overflow-hidden rounded-3xl border border-line">
              <Image
                src={SCENES.valpo.src}
                alt=""
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-[50%_35%]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
              <div className="relative flex min-h-[460px] flex-col justify-end gap-3 p-7 text-white sm:p-10">
                <h3 className="text-3xl font-extrabold sm:text-4xl">Hecho en español, desde Chile</h3>
                <p className="max-w-[48ch] text-white/85">
                  La plataforma, los guiones y el soporte están en español. Tus videos pueden hablar en inglés de Estados
                  Unidos para vender allá, o en español con acento chileno para tu público de acá.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Founders */}
        <section
          id="fundadores"
          aria-labelledby="beta"
          className="scroll-mt-24 px-[max(16px,env(safe-area-inset-left,0px))]"
        >
          <div className="relative mx-auto grid max-w-7xl gap-10 overflow-hidden rounded-[2rem] border border-line bg-surface p-7 sm:p-12 lg:grid-cols-2">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full opacity-30 blur-[100px]"
              style={{ background: "var(--grad)" }}
            />
            <div className="relative flex flex-col gap-5">
              <h2 id="beta" className="text-[2rem] font-extrabold sm:text-[2.6rem]">
                Entra como fundador
              </h2>
              <ul className="flex flex-col gap-3 text-[17px]">
                {[
                  "Precio especial que mantienes mientras sigas suscrito.",
                  "Acceso antes de la apertura, en grupos pequeños.",
                  "Contacto directo con el equipo para pedir formatos y estudios nuevos.",
                ].map((t) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden="true" className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-rec" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm text-muted">50 cupos. Te escribimos cuando abra tu grupo.</p>
            </div>
            <div className="relative flex flex-col gap-4 self-center">
              <p className="font-semibold">Déjanos tu correo y a qué te dedicas</p>
              <WaitlistForm id="final" />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq" className="px-[max(16px,env(safe-area-inset-left,0px))]">
          <div className="mx-auto flex max-w-3xl flex-col gap-6">
            <h2 id="faq" className="text-[2rem] font-extrabold sm:text-[2.6rem]">
              Preguntas frecuentes
            </h2>
            <div className="divide-y divide-line border-y border-line">
              {faqs.map((f) => (
                <details key={f.q} className="group py-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[17px] font-semibold">
                    {f.q}
                    <span aria-hidden="true" className="text-2xl leading-none text-muted transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-2 max-w-[65ch] text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line px-[max(16px,env(safe-area-inset-left,0px))]">
        <div className="mx-auto grid max-w-7xl gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-3">
            <Logo />
            <p className="max-w-[34ch] text-sm text-muted">El estudio de contenido con IA en español.</p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <b className="mb-1">Estudios</b>
            <a href="#estudios" className="text-muted hover:text-ink">Anuncios UGC</a>
            <a href="#estudios" className="text-muted hover:text-ink">Reels y TikToks</a>
            <a href="#estudios" className="text-muted hover:text-ink">Podcast IA</a>
            <a href="#estudios" className="text-muted hover:text-ink">Fotos de producto</a>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <b className="mb-1">Plataforma</b>
            <a href="#diferencia" className="text-muted hover:text-ink">Cómo funciona</a>
            <a href="#modelos" className="text-muted hover:text-ink">Modelos</a>
            <a href="#para-quien" className="text-muted hover:text-ink">Para quién</a>
            <a href="#fundadores" className="text-muted hover:text-ink">Beta de fundadores</a>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <b className="mb-1">Contacto</b>
            <span className="select-all text-muted">hola@creadsia.com</span>
          </div>
        </div>
        <p className="mx-auto max-w-7xl border-t border-line py-6 text-sm text-muted">© {new Date().getFullYear()} Creads</p>
      </footer>
    </div>
  );
}
