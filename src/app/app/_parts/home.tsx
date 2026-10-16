"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TOOLS } from "@/lib/tools";
import { PageHead, SetupNotice, cardCls } from "./ui";

type Counts = Record<"avatars" | "products" | "scripts" | "ads", number | null>;

export default function Home({ full = true }: { full?: boolean }) {
  const [c, setC] = useState<Counts | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const tables = ["avatars", "products", "scripts", "ads"] as const;
    Promise.all(tables.map((t) => fetch(`/api/data/${t}`).then(async (r) => ({ t, ok: r.ok, d: await r.json().catch(() => ({})) })))).then((all) => {
      if (all.some((x) => x.d?.missingTable)) setMissing(true);
      setC(Object.fromEntries(all.map((x) => [x.t, x.ok ? (x.d.rows?.length ?? 0) : null])) as Counts);
    });
  }, []);

  const next = !c
    ? null
    : !c.avatars
      ? { title: "Crea tu primer avatar", text: "Sube la cara y la voz de quien va a hablar en tus anuncios. Se carga una vez y sirve para todos los videos.", href: "/app/avatares", cta: "Crear avatar" }
      : { title: "Crea un anuncio", text: "Pega tu guion ganador, elige el formato y quién habla. Creads lo divide en cortes y genera cada escena.", href: "/app/crear", cta: "Crear anuncio" };

  const tiles: [string, number | null | undefined, string, string][] = [
    ["Avatares", c?.avatars, "/app/avatares", "Ver avatares"],
    ["Productos", c?.products, "/app/productos", "Ver productos"],
    ["Guiones guardados", c?.scripts, "/app/crear", "Abrir guiones"],
    ["Anuncios", c?.ads, "/app/biblioteca", "Ver biblioteca"],
  ];

  return (
    <>
      <PageHead title="Qué hacer hoy" lead="Espía lo que funciona, produce tus versiones y guarda los anuncios terminados." />
      {missing && <SetupNotice />}
      {next && (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-[image:var(--grad)] p-[1px]">
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[15px] bg-surface p-5">
            <div className="flex max-w-xl flex-col gap-1">
              <span className="text-xs font-bold tracking-wider text-accent-text uppercase">Siguiente paso</span>
              <h2 className="font-display text-xl font-bold">{next.title}</h2>
              <p className="text-sm text-muted">{next.text}</p>
            </div>
            <Link href={next.href} className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink">{next.cta}</Link>
          </div>
        </section>
      )}
      <ol className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3" aria-label="Tu avance">
        {tiles.map(([label, n, href, cta]) => (
          <li key={label}>
            <Link href={href} className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent/60">
              <span className="font-mono text-3xl font-bold tabular-nums">{n == null ? "—" : n}</span>
              <span className="font-semibold">{label}</span>
              <span className="text-sm text-accent-text">{cta} →</span>
            </Link>
          </li>
        ))}
      </ol>
      {full && <section className={cardCls} aria-labelledby="quick">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="quick" className="font-display text-lg font-bold">Herramientas IA</h2>
          <Link href="/app/herramientas" className="text-sm text-accent-text">Ver todas →</Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/laboratorio" className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-muted">Video IA</Link>
          <Link href="/app/laboratorio" className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-muted">Imagen IA</Link>
          {TOOLS.map((t) => (
            <Link key={t.id} href={`/app/herramientas/${t.id}`} className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-muted">{t.name}</Link>
          ))}
        </div>
      </section>}
      <section className={cardCls}>
        <h2 className="font-display text-lg font-bold">Cómo se hace un anuncio en Creads</h2>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Guion", "Pega tu guion ganador o escríbelo. Puede estar en inglés o en español."],
            ["Cortes", "Claude lo divide en cortes de hasta 8 segundos y lo adapta al formato."],
            ["Escenas", "Elige quién habla, el lugar y el producto. Cada corte se genera con el modelo que elijas."],
            ["Anuncio", "Revisamos cada corte, lo armamos con voz y subtítulos, y queda en tu biblioteca."],
          ].map(([t, d], i) => (
            <li key={t} className="flex flex-col gap-1 rounded-xl bg-surface-2 p-4">
              <span className="font-mono text-xs font-bold text-muted">Paso {i + 1}</span>
              <span className="font-semibold">{t}</span>
              <span className="text-sm text-muted">{d}</span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
