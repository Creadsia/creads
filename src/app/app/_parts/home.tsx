"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { TOOLS } from "@/lib/tools";
import { PageHead, SetupNotice, cardCls } from "./ui";

type Counts = Record<"avatars" | "products" | "scripts" | "ads", number | null>;

interface Step { n: number; title: string; text: string; href: string; cta: string; done: boolean; optional?: boolean }

export default function Home({ full = true }: { full?: boolean }) {
  const [c, setC] = useState<Counts | null>(null);
  const [voices, setVoices] = useState<number | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const tables = ["avatars", "products", "scripts", "ads"] as const;
    Promise.all(tables.map((t) => fetch(`/api/data/${t}?count=1`).then(async (r) => ({ t, ok: r.ok, d: await r.json().catch(() => ({})) })).catch(() => ({ t, ok: false, d: {} as Record<string, unknown> }))))
      .then((all) => {
        if (all.some((x) => !x.ok)) setMissing(true);
        setC(Object.fromEntries(all.map((x) => [x.t, x.ok ? Number(x.d.count ?? 0) : null])) as Counts);
      });
    fetch("/api/voices").then((r) => (r.ok ? r.json() : null)).then((d) => setVoices(d ? (d.voices ?? []).filter((v: { category?: string }) => v.category === "cloned").length : 0)).catch(() => setVoices(0));
  }, []);

  // The order a new customer works in: brand first (once), then script → ad.
  const steps: Step[] = !c ? [] : [
    { n: 1, title: "Crea tu voz", text: "Graba o sube unos minutos de audio y la IA clona tu voz. Si prefieres, usa una voz de la biblioteca.", href: "/app/voces", cta: "Crear voz", done: (voices ?? 0) > 0, optional: true },
    { n: 2, title: "Crea tu avatar", text: "Una foto de la cara de quien habla, con su voz. Se hace una vez y sirve para todos tus anuncios.", href: "/app/avatares", cta: "Crear avatar", done: (c.avatars ?? 0) > 0 },
    { n: 3, title: "Agrega tu producto", text: "Si vendes algo físico, sube su foto para que aparezca en los videos.", href: "/app/productos", cta: "Agregar producto", done: (c.products ?? 0) > 0, optional: true },
    { n: 4, title: "Crea tu guion", text: "Busca un anuncio que esté funcionando en tu nicho (en «Espiar anuncios»), pégalo y mejóralo con la IA: hooks, ángulos y cada línea.", href: "/app/guiones", cta: "Crear guion", done: (c.scripts ?? 0) > 0 || (c.ads ?? 0) > 0 },
    { n: 5, title: "Crea tu anuncio", text: "Pega el guion, elige tu avatar y genera. Creads revisa cada corte y lo arma con voz y subtítulos.", href: "/app/crear", cta: "Crear anuncio", done: (c.ads ?? 0) > 0 },
  ];
  const required = steps.filter((x) => !x.optional);
  const starting = steps.length > 0 && required.some((x) => !x.done);
  const doneCount = steps.filter((x) => x.done).length;
  const nextStep = steps.find((x) => !x.done && !x.optional) ?? null;

  const tiles: [string, number | null | undefined, string, string][] = [
    ["Avatares", c?.avatars, "/app/avatares", "Ver avatares"],
    ["Productos", c?.products, "/app/productos", "Ver productos"],
    ["Guiones guardados", c?.scripts, "/app/guiones", "Abrir guiones"],
    ["Anuncios", c?.ads, "/app/biblioteca", "Ver anuncios terminados"],
  ];

  return (
    <>
      <PageHead title={starting ? "Bienvenido a Creads" : "Qué hacer hoy"} lead={starting ? "Sigue estos pasos en orden. Los primeros se hacen una sola vez; después, cada anuncio es guion → anuncio." : "Crea tus anuncios, revisa cómo avanzan y guarda los terminados."} />
      {missing && <SetupNotice />}

      {starting ? (
        <section className={cardCls} aria-labelledby="pasos">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="pasos" className="font-display text-lg font-bold">Primeros pasos</h2>
            <span className="text-sm text-muted">{doneCount} de {steps.length} listos</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div className="h-full rounded-full bg-[image:var(--grad)] transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ol className="flex flex-col gap-2">
            {steps.map((x) => {
              const isNext = nextStep?.n === x.n;
              return (
                <li key={x.n} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 sm:flex-nowrap ${isNext ? "border-accent-text/50 bg-accent/5" : "border-line"}`}>
                  <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${x.done ? "bg-good/15 text-good" : isNext ? "bg-[image:var(--grad)] text-white" : "bg-surface-2 text-muted"}`}>{x.done ? "✓" : x.n}</span>
                  <span className="flex min-w-0 flex-1 basis-[calc(100%-3rem)] flex-col sm:basis-auto">
                    <span className="flex flex-wrap items-center gap-2"><b className={`text-sm ${x.done ? "text-muted line-through" : ""}`}>{x.title}</b>{x.optional && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-muted">Opcional</span>}</span>
                    {!x.done && <span className="text-xs text-muted">{x.text}</span>}
                    <span className="sr-only">{x.done ? "Listo" : "Pendiente"}</span>
                  </span>
                  {!x.done && <Link href={x.href} className={`ml-11 shrink-0 rounded-lg px-3 py-2 text-center text-sm font-semibold sm:ml-0 ${isNext ? "bg-accent text-accent-ink" : "border border-line text-muted hover:text-ink"}`}>{x.cta}</Link>}
                </li>
              );
            })}
          </ol>
          {full && <p className="text-xs text-muted">¿Buscas <Link href="/app/historias" className="font-semibold text-accent-text underline">Historias animadas</Link>, <Link href="/app/laboratorio" className="font-semibold text-accent-text underline">Video e imagen IA</Link> o las <Link href="/app/herramientas" className="font-semibold text-accent-text underline">Herramientas IA</Link>? Están en «Crear anuncio», junto a los formatos UGC y Podcast.</p>}
        </section>
      ) : (
        c && (
          <section className="flex flex-col gap-3 rounded-2xl border border-line bg-[image:var(--grad)] p-[1px]">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[15px] bg-surface p-5">
              <div className="flex max-w-xl flex-col gap-1">
                <h2 className="font-display text-xl font-bold">Haz tu próximo anuncio</h2>
                <p className="text-sm text-muted">Mira qué está funcionando en tu nicho, conviértelo en un guion mejor y créalo en el formato que quieras.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {full && <Link href="/app/spy" className="rounded-xl border border-line px-5 py-2.5 font-semibold">1 · Espiar</Link>}
                <Link href="/app/guiones" className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink">{full ? "2" : "1"} · Crear guion</Link>
                <Link href="/app/crear" className="rounded-xl border border-line px-5 py-2.5 font-semibold">{full ? "3" : "2"} · Crear anuncio</Link>
              </div>
            </div>
          </section>
        )
      )}

      {!starting && (
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
      )}

      {full && !starting && c && (
        <section className={cardCls} aria-labelledby="quick">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="quick" className="font-display text-lg font-bold">Más formas de crear</h2>
            <Link href="/app/herramientas" className="text-sm text-accent-text">Ver todas →</Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/app/historias" className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-muted">Historias animadas</Link>
            <Link href="/app/laboratorio" className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-muted">Video e imagen IA</Link>
            {TOOLS.slice(0, 6).map((t) => (
              <Link key={t.id} href={`/app/herramientas/${t.id}`} className="rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-muted">{t.name}</Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
