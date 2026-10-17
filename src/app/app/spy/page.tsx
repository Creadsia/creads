import type { Metadata } from "next";
import { FullOnly } from "../_parts/full-only";
import { NextStep, PageHead, Stepper, cardCls } from "../_parts/ui";

export const metadata: Metadata = { title: "Espiar anuncios" };

// Step 1 of a campaign. Until the in-house ad library is ready, this page teaches the free way to
// find winning ads (Meta's Ad Library) and sends the customer on to step 2 with what they found.
export default function SpyPage() {
  const steps: [string, string][] = [
    ["Abre la Biblioteca de anuncios de Meta", "Es gratis y muestra todos los anuncios activos en Facebook e Instagram."],
    ["Busca tu nicho", "Escribe lo que vendes (por ejemplo «remodelación de baño» o «seguro de auto») y elige tu país."],
    ["Fíjate en la fecha", "Un anuncio que lleva 30 días o más activo está funcionando: nadie paga semanas por un anuncio que no vende."],
    ["Copia lo que dice", "Abre el video y anota el guion: el inicio (hook), el problema, la oferta y el llamado a la acción."],
  ];
  return (
    <>
      <Stepper flow="anuncio" current={0} />
      <PageHead title="Espiar anuncios" lead="Antes de crear, mira qué está funcionando en tu nicho. Si alguien lleva semanas pagando un anuncio, ese anuncio vende." />
      <FullOnly>
        <section className={cardCls} aria-labelledby="como">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="como" className="font-display text-lg font-bold">Cómo encontrar anuncios ganadores (gratis)</h2>
            <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">Muy pronto: buscador dentro de Creads</span>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {steps.map(([t, d], i) => (
              <li key={t} className="flex gap-3 rounded-xl bg-surface-2 p-4">
                <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[image:var(--grad)] text-sm font-bold text-white">{i + 1}</span>
                <span className="flex flex-col gap-0.5"><b className="text-sm">{t}</b><span className="text-sm text-muted">{d}</span></span>
              </li>
            ))}
          </ol>
          <a href="https://www.facebook.com/ads/library/" target="_blank" rel="noopener noreferrer" className="self-start rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink">Abrir la Biblioteca de anuncios ↗</a>
        </section>
        <NextStep href="/app/guiones" title="Crea tu guion con el anuncio que encontraste" text="Pégalo en «Crear guion»: la IA lo desarma, te explica por qué funciona y te da 3 ángulos o 10 hooks nuevos." />
      </FullOnly>
    </>
  );
}
