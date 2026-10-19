import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { es } from "@/content/es";
import { CATEGORIAS, findCategoria } from "@/content/ia";
import { creditsFor } from "@/lib/credit-math";
import { EXAMPLES, examplesOf, type Example } from "@/lib/examples";
import { imageProviders, videoProviders } from "@/lib/providers";
import { Logo } from "../../brand";
import { Gallery } from "../../gallery";
import { BreakdownMock, Flow, ScriptMock, SiteHeader, SpyMock } from "../../landing";
import CategoryStudio, { type PanelModel } from "../category-studio";

// creadsia.com/ia/<categoría>: one page per item of the site's top menu, with examples, what you get
// and a way into the studio. Static (rebuilt hourly) so it loads fast for ads traffic.
export const revalidate = 3600;
export const dynamicParams = false;
export function generateStaticParams() {
  return CATEGORIAS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = findCategoria((await params).slug);
  if (!c) return {};
  const title = `${c.menu} con IA · Creads`;
  return { title, description: c.seo, alternates: { canonical: `/ia/${c.slug}` }, openGraph: { title, description: c.seo, url: `/ia/${c.slug}`, locale: "es_CL" } };
}

const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";
const per8 = (usd: number) => `${creditsFor(usd * 8).toLocaleString("es-CL")} créd. / 8 s`;

function panelModels(kind: "video" | "imagen"): PanelModel[] {
  if (kind === "imagen") {
    return imageProviders.map((p) => ({ id: p.id, label: p.label, credits: `${creditsFor(p.usdPerImage).toLocaleString("es-CL")} créd.`, aspects: ["9:16", "4:5", "1:1", "16:9"] }));
  }
  return videoProviders.map((p) => ({
    id: p.id,
    label: p.label,
    credits: per8(p.usdPerSecond),
    aspects: p.aspects ?? ["9:16", "4:5", "1:1", "16:9"],
    seconds: p.durations ?? [4, 6, 8],
    note: [p.silent ? "Sin audio" : "Con audio", p.needsImage ? "parte de una imagen" : ""].filter(Boolean).join(" · "),
  }));
}

export default async function CategoriaPage({ params }: { params: Promise<{ slug: string }> }) {
  const c = findCategoria((await params).slug);
  if (!c) notFound();
  const examples: Example[] = !c.examples ? [] : Array.isArray(c.examples) ? c.examples.map((id) => EXAMPLES.find((e) => e.id === id)).filter((e): e is Example => Boolean(e)) : examplesOf(c.examples);
  const m = es.flow.mock;

  return (
    <div className="overflow-x-clip">
      <SiteHeader t={es} onHome={false} current={`/ia/${c.slug}`} />
      <main className={`flex flex-col gap-16 py-10 sm:py-14 ${gutter}`}>
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10">
          <header className="flex max-w-3xl flex-col gap-4">
            <h1 className="font-display text-[2.3rem] leading-[1.05] font-semibold sm:text-5xl">{c.title}</h1>
            <p className="text-lg text-muted">{c.lead}</p>
          </header>

          {c.panel ? (
            <CategoryStudio kind={c.panel} models={panelModels(c.panel)} examples={examples} />
          ) : (
            <div className="grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
              <aside className="flex flex-col gap-5 rounded-3xl border border-line bg-surface p-5 lg:sticky lg:top-28">
                <ul className="flex flex-col gap-3">
                  {c.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-[15px]">
                      <svg viewBox="0 0 24 24" className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                      {p}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-2 border-t border-line pt-4">
                  <a href={c.app} className="rounded-xl bg-[image:var(--grad)] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)]">{c.cta}</a>
                  <Link href="/#pricing" className="rounded-xl border border-line px-4 py-3 text-center text-sm font-semibold hover:bg-surface-2">Ver planes · desde US$15</Link>
                </div>
              </aside>
              {c.mock ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="h-72 text-[13px]">{c.mock === "espiar" ? <SpyMock m={m} /> : <BreakdownMock m={m} />}</div>
                  <div className="h-72 text-[13px]">{c.mock === "espiar" ? <BreakdownMock m={m} /> : <ScriptMock m={m} />}</div>
                </div>
              ) : (
                <Gallery examples={examples} filterBy={examples.length > 6 ? "tag" : null} columns="columns-2 sm:columns-3 2xl:columns-4" />
              )}
            </div>
          )}
        </div>

        {c.flow && <section className="mx-auto w-full max-w-7xl"><Flow t={es.flow} ctaHref="/app/crear" /></section>}

        {c.panel && (
          <ul className="mx-auto grid w-full max-w-7xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {c.points.map((p) => <li key={p} className="rounded-2xl border border-line bg-surface p-4 text-sm">{p}</li>)}
          </ul>
        )}

        <nav aria-label="Más formas de crear" className="mx-auto flex w-full max-w-7xl flex-col gap-3">
          <h2 className="text-lg font-semibold">Más formas de crear con Creads</h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIAS.filter((x) => x.slug !== c.slug).map((x) => (
              <a key={x.slug} href={`/ia/${x.slug}`} className="rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink">{x.menu}</a>
            ))}
          </div>
        </nav>
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
