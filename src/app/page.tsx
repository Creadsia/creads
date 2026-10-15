import Image from "next/image";
import AdPhone from "./ad-phone";
import WaitlistForm from "./waitlist-form";

// The real pipeline, in order — so these are numbered on purpose.
const steps = [
  {
    t: "Pegas tu guion ganador",
    d: "El que ya te trae leads, en inglés o en español.",
    ex: "“We got three quotes before repairing our foundation…”",
  },
  {
    t: "Creads lo corta en escenas",
    d: "Hasta 8 cortes de máximo 8 segundos, cada uno con su gancho, su dolor o su llamada a la acción.",
    ex: "8 cortes · Hook → CTA",
  },
  {
    t: "Genera cada corte con la misma persona",
    d: "Misma cara, misma ropa y mismo lugar de principio a fin. Puede ser un avatar o tu propia cara y voz.",
    ex: "Corte 4 · 7,6 s · misma ropa, mismo porche",
  },
  {
    t: "Revisa antes de entregarte",
    d: "Escucha cada corte, lo compara palabra por palabra con tu guion y rehace solo lo que salió mal.",
    ex: "Corte 2 dice “$34,000” ✓",
  },
  {
    t: "Te entrega 3 anuncios armados",
    d: "Con subtítulos estilo reel, en 9:16 o 1:1, listos para subir a Meta.",
    ex: "3 variaciones de hook · subtítulos incluidos",
  },
];

const formats = [
  { n: "UGC selfie", d: "Una persona cuenta su experiencia mirando a cámara." },
  { n: "Podcast", d: "Dos voces conversando: el invitado cuenta la historia y el host cierra con la oferta." },
  { n: "Ronda de testimonios", d: "Alguien graba en un lugar y le pregunta lo mismo a varias personas distintas." },
  { n: "Drive-thru", d: "Preguntas rápidas en la fila del auto. Funciona muy bien en seguros de auto." },
  { n: "Noticiero", d: "Formato de nota informativa, con presentador y dato duro." },
  { n: "Comentario", d: "Responde un comentario real que aparece en pantalla como burbuja." },
];

const faqs = [
  {
    q: "¿Necesito saber editar video?",
    a: "No. Pegas el guion, eliges formato y persona, y recibes los anuncios armados. Si un corte no te gusta, escribes qué cambiar y Creads lo rehace.",
  },
  {
    q: "¿En qué idioma salen los anuncios?",
    a: "En inglés de Estados Unidos, que es donde corren la mayoría de las ofertas de lead-gen. También hay modo español (Chile).",
  },
  {
    q: "¿Puedo usar mi propia cara o voz?",
    a: "Sí, con tu autorización. También puedes usar avatares creados con IA. Nunca usamos la cara o la voz de alguien sin su consentimiento.",
  },
  {
    q: "¿Sirve para mi nicho?",
    a: "Está pensado para lead-gen de servicios: seguros, remodelación, fundaciones y otros servicios para el hogar. Los formatos funcionan para cualquier oferta que se venda con una historia.",
  },
  {
    q: "¿Cuánto va a costar?",
    a: "Planes mensuales con anuncios incluidos. Los fundadores conocen el precio primero y lo mantienen de por vida.",
  },
];

function Logo() {
  return (
    <a href="#" className="flex items-center gap-2.5" aria-label="Creads, inicio">
      <Image src="/logo.svg" alt="" width={30} height={30} priority />
      <span className="font-display text-lg font-extrabold tracking-tight [font-stretch:112%]">
        Cre<span className="grad-text">ads</span>
      </span>
    </a>
  );
}

export default function Home() {
  return (
    <div className="px-[max(16px,env(safe-area-inset-left,0px))]">
      <header className="mx-auto flex max-w-6xl items-center justify-between py-5">
        <Logo />
        <a
          href="#fundadores"
          className="rounded-lg border border-line px-3.5 py-2 text-sm font-semibold transition-colors hover:border-accent"
        >
          Unirme a la beta
        </a>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-28 pb-20">
        {/* Hero: the ad itself is the argument */}
        <section className="grid items-center gap-12 pt-6 lg:grid-cols-[1.15fr_0.85fr] lg:pt-14">
          <div className="flex min-w-0 flex-col gap-7">
            <h1 className="text-[2.6rem] font-extrabold sm:text-6xl">
              Tu guion ganador, convertido en anuncios listos para Meta.
            </h1>
            <p className="max-w-[58ch] text-lg text-muted">
              Pegas el guion que ya te trae leads. Creads lo corta en escenas, genera cada una con IA, revisa que diga
              exactamente tus palabras y te entrega 3 versiones armadas con subtítulos.
            </p>
            <WaitlistForm id="hero" compact />
            <p className="text-sm text-muted">
              Beta de fundadores: 50 cupos, con precio especial de por vida.
            </p>
          </div>
          <AdPhone />
        </section>

        {/* Pipeline */}
        <section className="flex flex-col gap-10" aria-labelledby="como">
          <div className="flex max-w-2xl flex-col gap-3">
            <h2 id="como" className="text-3xl font-extrabold sm:text-4xl">
              Del guion al anuncio, sin abrir un editor
            </h2>
            <p className="text-muted">
              Es el mismo proceso que haría un editor con un equipo de grabación, pero en minutos y con la revisión
              incluida.
            </p>
          </div>
          <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-5">
            {steps.map((s, i) => (
              <li key={s.t} className="flex flex-col gap-3 bg-surface p-5">
                <span className="font-display text-3xl font-extrabold text-accent-text [font-stretch:75%]">{i + 1}</span>
                <h3 className="text-lg font-bold [font-stretch:100%]">{s.t}</h3>
                <p className="text-[15px] leading-relaxed text-muted">{s.d}</p>
                <p className="mt-auto border-t border-line pt-3 text-sm text-ink">{s.ex}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Formats */}
        <section className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]" aria-labelledby="formatos">
          <div className="flex flex-col gap-3">
            <h2 id="formatos" className="text-3xl font-extrabold sm:text-4xl">
              Formatos probados en campañas reales
            </h2>
            <p className="text-muted">
              Cada formato trae sus propias reglas de cortes, de cámara y de quién habla, para que el anuncio se vea
              grabado y no generado.
            </p>
          </div>
          <dl className="divide-y divide-line border-y border-line">
            {formats.map((f) => (
              <div key={f.n} className="grid gap-1 py-4 sm:grid-cols-[11rem_1fr] sm:gap-6">
                <dt className="font-display text-lg font-bold [font-stretch:100%]">{f.n}</dt>
                <dd className="text-muted">{f.d}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Founder story */}
        <section className="grid gap-8 rounded-3xl bg-surface p-7 sm:p-10 lg:grid-cols-[0.8fr_1.2fr]" aria-labelledby="origen">
          <h2 id="origen" className="text-3xl font-extrabold sm:text-4xl">
            Lo construí para mis propias campañas
          </h2>
          <div className="flex max-w-[62ch] flex-col gap-4 text-[17px]">
            <p>
              Corro campañas de lead-gen en Meta: reparación de fundaciones, remodelación de baños y seguros de auto.
              Necesitaba probar muchos anuncios por semana y no podía depender de grabar cada uno.
            </p>
            <p className="text-muted">
              Creads nació ahí. Cada error que veía en un video (la ropa que cambia entre cortes, un número mal dicho,
              un subtítulo cortado) se convirtió en una regla que la IA revisa sola. Ahora lo abro para otros que
              compran tráfico como yo.
            </p>
          </div>
        </section>

        {/* Founders offer + form */}
        <section id="fundadores" className="grid scroll-mt-8 gap-10 lg:grid-cols-2" aria-labelledby="beta">
          <div className="flex flex-col gap-5">
            <h2 id="beta" className="text-3xl font-extrabold sm:text-4xl">
              Entra como fundador
            </h2>
            <ul className="flex flex-col gap-3">
              {[
                "Precio especial que mantienes mientras sigas suscrito.",
                "Acceso antes de la apertura, en grupos pequeños.",
                "Línea directa conmigo para pedir formatos y nichos.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden="true" className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">50 cupos. Te escribimos por correo cuando abra tu grupo.</p>
          </div>
          <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <p className="font-semibold">Déjanos tu correo y tu nicho</p>
            <WaitlistForm id="final" />
          </div>
        </section>

        {/* FAQ */}
        <section className="flex flex-col gap-6" aria-labelledby="faq">
          <h2 id="faq" className="text-3xl font-extrabold sm:text-4xl">
            Preguntas frecuentes
          </h2>
          <div className="divide-y divide-line border-y border-line">
            {faqs.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                  {f.q}
                  <span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-2 max-w-[65ch] text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-6xl flex-col gap-3 border-t border-line py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <Logo />
        <span>
          © {new Date().getFullYear()} Creads · <span className="select-all">hola@creadsia.com</span>
        </span>
      </footer>
    </div>
  );
}
