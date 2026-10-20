import type { Metadata } from "next";
import Link from "next/link";
import { es } from "@/content/es";
import { fetchableUrl } from "@/lib/media";
import { Logo } from "../brand";
import { SiteHeader } from "../landing";
import MasterclassForm from "./masterclass-form";

// creadsia.com/curso: the course «Anuncios con IA de punta a punta» and the free masterclass sign-up.
// Draft for the owner's review (staging): pre-sale opens after the masterclass.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Curso: anuncios con IA de punta a punta · Creads",
  description: "Aprende a crear anuncios en video con IA en 1 hora: espiar, guion y hooks, crear y lanzar en Meta. Masterclass gratis.",
  alternates: { canonical: "/curso" },
};

const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";

// The teacher: an original character made with Creads (the owner's chosen still).
const TEACHER = "/api/media/ws/main/images/d7fc3b51-8733-4226-b30a-6cae3c7447c4.png";

const LESSONS: [string, string, string][] = [
  ["Antes de partir", "Qué hace que un anuncio venda y los 5 pasos", "3 min"],
  ["Espiar", "Encuentra los anuncios que llevan semanas activos en tu nicho", "7 min"],
  ["Desarmar", "Hook, ángulo, dolor, oferta y llamado: por qué funciona", "7 min"],
  ["Guion y hooks", "3 versiones tuyas y 10 hooks, sin copiar", "9 min"],
  ["Tu marca", "Voz, avatar y tu producto en las escenas", "6 min"],
  ["Crear", "Del guion al anuncio terminado, en 9:16 y 4:5", "14 min"],
  ["Lanzar", "Una campaña simple en Meta con US$10 al día", "8 min"],
  ["Leer e iterar", "Qué mirar los primeros días y cómo hacer la segunda ronda", "6 min"],
];

const FAQ: [string, string][] = [
  ["¿Necesito saber editar o grabar?", "No. Todo se hace en Creads: el guion, la voz, la persona, los cortes y los subtítulos."],
  ["¿El profesor es una persona real?", "No. Es un personaje creado con IA en Creads, igual que todo el curso. Lo decimos desde el primer minuto porque es justamente lo que vas a aprender a hacer."],
  ["¿Me garantizan ventas?", "No. Te enseñamos el proceso completo y te mostramos campañas reales con sus números reales. Los resultados dependen de tu producto, tu oferta y tu presupuesto."],
  ["¿Qué pasa después del primer mes de Creads?", "Si te sirve, sigues con el plan Starter a US$30 al mes. Si no, lo cancelas y el curso sigue siendo tuyo."],
  ["¿Sirve para mi negocio?", "Está pensado para e-commerce, emprendedores y quienes crean anuncios para otros. Si vendes algo por internet y pagas anuncios en Meta o TikTok, es para ti."],
];

async function teacherUrl() {
  try {
    return await fetchableUrl(TEACHER, "main", 3 * 3600);
  } catch {
    return null;
  }
}

export default async function CursoPage() {
  const teacher = await teacherUrl();
  return (
    <div className="overflow-x-clip">
      <SiteHeader t={es} onHome={false} />
      <main className={`flex flex-col gap-20 py-10 sm:py-16 ${gutter}`}>
        {/* hero */}
        <section className="mx-auto grid w-full max-w-7xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div id="masterclass" className="flex scroll-mt-32 flex-col gap-6">
            <h1 className="font-display text-[2.4rem] leading-[1.04] font-semibold sm:text-6xl">Aprende a crear anuncios con IA en 1 hora</h1>
            <p className="max-w-[56ch] text-lg text-muted">Del anuncio ganador de tu competencia a tu campaña publicada en Meta. Sin grabar, sin actores y sin editor. Parte con la masterclass gratis.</p>
            <MasterclassForm />
          </div>
          <figure className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] border border-line bg-surface-2">
            {teacher
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={teacher} alt="El profesor del curso, un personaje creado con IA en Creads" className="absolute inset-0 h-full w-full object-cover" />
              : <div aria-hidden="true" className="absolute inset-0 opacity-40 blur-[60px]" style={{ background: "var(--grad)" }} />}
            <figcaption className="absolute inset-x-3 bottom-3 rounded-2xl bg-black/65 px-4 py-3 text-sm text-white backdrop-blur-sm">
              Tu profesor es un personaje creado con IA en Creads. Igual que todo este curso.
            </figcaption>
          </figure>
        </section>

        {/* made with Creads */}
        <section className="mx-auto grid w-full max-w-7xl gap-6 rounded-[2rem] border border-line bg-surface p-6 sm:p-10 lg:grid-cols-[1fr_1.2fr]">
          <h2 className="text-[1.9rem] leading-tight font-extrabold sm:text-4xl">Este curso se hizo entero con Creads</h2>
          <div className="flex flex-col gap-3 text-muted">
            <p>El profesor, su voz, los cortes y los subtítulos salen de Creads. Si el curso se ve profesional, ya viste lo que vas a poder hacer.</p>
            <p>Las campañas que mostramos son reales, con sus números reales: lo que funcionó y lo que no.</p>
          </div>
        </section>

        {/* lessons */}
        <section className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-[1.9rem] leading-tight font-extrabold sm:text-4xl">8 lecciones, 1 hora</h2>
            <p className="text-muted">Al terminar tienes 3 anuncios hechos y una campaña lista.</p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {LESSONS.map(([name, text, time], i) => (
              <li key={name} className="flex items-start gap-4 rounded-2xl border border-line bg-surface p-4">
                <b className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-sm text-bg">{i}</b>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5"><b>{name}</b><span className="text-sm text-muted">{text}</span></span>
                <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 font-mono text-xs text-muted">{time}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* offer */}
        <section className="mx-auto grid w-full max-w-5xl gap-8 rounded-[2rem] border border-line bg-surface p-6 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex flex-col gap-3">
            <h2 className="text-[1.9rem] leading-tight font-extrabold sm:text-4xl">El curso + tu primer mes de Creads</h2>
            <ul className="flex flex-col gap-2 text-[15px]">
              {["Las 8 lecciones, sin fecha de vencimiento", "Plantilla de guion, 50 hooks y checklists", "Tu primer mes de Creads Starter: 300 créditos para practicar", "Después, Starter a US$30 al mes solo si quieres seguir"].map((x) => (
                <li key={x} className="flex gap-2.5"><svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>{x}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col items-start gap-2 md:items-end">
            <span className="chroma font-display text-6xl font-semibold">US$47</span>
            <span className="text-sm text-muted">pago único · preventa</span>
            <a href="#masterclass" className="mt-2 rounded-xl border border-line px-5 py-3 text-sm font-semibold hover:bg-surface-2">La preventa abre después de la masterclass</a>
          </div>
        </section>

        {/* faq */}
        <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <h2 className="text-[1.9rem] leading-tight font-extrabold sm:text-4xl">Preguntas</h2>
          {FAQ.map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-line bg-surface px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold">{q}</summary>
              <p className="mt-2 text-muted">{a}</p>
            </details>
          ))}
        </section>
      </main>
      <footer className={`border-t border-line ${gutter}`}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 py-8 text-sm text-muted">
          <Logo href="/" />
          <span className="flex flex-wrap gap-4">
            <Link href="/#pricing" className="hover:text-ink">Precios</Link>
            <a href="/terminos" className="hover:text-ink">Términos</a>
            <a href="/privacidad" className="hover:text-ink">Privacidad</a>
            <span className="select-all">hola@creadsia.com</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
