import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "../brand";
import ThemeToggle from "../theme-toggle";
import DemoPhone from "../demo-phone";

// Phase 2 (launch audit, 23 Oct 2026): the landing for media buyers, agencies and affiliates. Built but NOT
// published: it answers 404 until LANDING_FASE2=1 is set in Vercel. Copy without invented numbers or
// clients; the proof is the ads themselves.

export const metadata: Metadata = {
  title: "Creads IA para agencias, media buyers y afiliados",
  description: "Decenas de anuncios UGC con IA para testear creativos: muchas personas, acentos, ganchos y ángulos, con API y conector.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";
const wrap = "mx-auto w-full max-w-6xl";
const h2 = "font-display text-[1.7rem] leading-[1.1] font-semibold sm:text-[2.3rem]";

const POINTS = [
  ["Volumen para testear", "Un guion → 10 ganchos → 3 ángulos → varias personas. Encuentras el creativo ganador antes de que el anterior se canse."],
  ["Personas y acentos", "Hombres y mujeres de distintas edades, con voz chilena, argentina, mexicana, colombiana, venezolana o en inglés de EE. UU."],
  ["Revisado antes de entregar", "Creads escucha cada palabra y mira cada escena. Si hay un error grave, lo rehace solo una vez antes de entregarte."],
  ["Varias marcas, un equipo", "Cada cliente en su espacio, con su equipo y sus avatares. Un solo saldo de créditos."],
  ["API y conector", "Pide anuncios desde tu propio sistema, o desde Claude o ChatGPT con el conector de Creads."],
  ["Historias dramatizadas", "Formato testimonial con actor IA y la etiqueta «Dramatización · actor IA», para que tus campañas no tengan problemas con Meta."],
] as const;

export default function Agencias() {
  if (process.env.LANDING_FASE2 !== "1") notFound();
  return (
    <div className="overflow-x-clip">
      <header className="border-b border-line/60">
        <div className={`${wrap} flex items-center justify-between gap-3 py-3 ${gutter}`}>
          <Logo href="/" />
          <div className="flex items-center gap-2">
            <ThemeToggle lang="es" />
            <a href="/app" className="px-2 text-sm font-semibold text-muted hover:text-ink">Entrar</a>
            <a href="/registro" className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-bg">Probar gratis</a>
          </div>
        </div>
      </header>
      <main className="flex flex-col gap-16 py-10 sm:gap-24 sm:py-16">
        <section className={gutter}>
          <div className={`${wrap} grid items-center gap-10 lg:grid-cols-2`}>
            <div className="flex flex-col gap-5">
              <h1 className="font-display text-[2.3rem] leading-[1.03] font-semibold sm:text-[3.4rem]">Creativos UGC para testear, al ritmo de tus campañas</h1>
              <p className="max-w-[52ch] text-lg text-muted">Para media buyers, agencias y afiliados: muchas versiones del mismo anuncio, con distintas personas, ganchos y acentos, revisadas antes de entregarlas.</p>
              <div className="flex flex-wrap gap-3">
                <a href="/registro" className="rounded-xl bg-[image:var(--grad)] px-6 py-3 font-semibold text-white">Probar gratis</a>
                <a href="mailto:hola@creadsia.com?subject=Creads%20para%20agencias" className="rounded-xl border border-line px-6 py-3 font-semibold">Hablar con nosotros</a>
              </div>
            </div>
            <div className="flex justify-center gap-3">
              <DemoPhone src="/demos/gym.mp4" poster="/demos/gym.jpg" label="Gimnasio" className="w-[38vw] max-w-[190px]" />
              <DemoPhone src="/demos/rubia.mp4" poster="/demos/rubia.jpg" label="Bebida energética" big sound className="w-[42vw] max-w-[220px]" />
            </div>
          </div>
        </section>
        <section className={gutter} aria-labelledby="por-que">
          <div className={`${wrap} flex flex-col gap-6`}>
            <h2 id="por-que" className={h2}>Hecho para equipos que testean todos los días</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {POINTS.map(([t, d]) => (
                <article key={t} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
                  <h3 className="text-lg font-bold">{t}</h3>
                  <p className="text-sm text-muted">{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className={gutter}>
          <div className={`${wrap} flex flex-col items-start gap-4 rounded-3xl border border-line bg-surface p-8`}>
            <h2 className={h2}>¿Manejas varias cuentas?</h2>
            <p className="max-w-2xl text-muted">Escríbenos y armamos un plan para tu volumen, con API y espacios por cliente.</p>
            <a href="mailto:hola@creadsia.com?subject=Creads%20para%20agencias" className="rounded-xl bg-ink px-6 py-3 font-semibold text-bg">Escribir a hola@creadsia.com</a>
          </div>
        </section>
      </main>
    </div>
  );
}
