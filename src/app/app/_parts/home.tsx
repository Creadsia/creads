"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHead, SetupNotice, cardCls } from "./ui";
import { useCredits } from "./use-credits";
import { adsOf, fmtSeconds, secondsOf } from "@/lib/credit-math";

type Counts = Record<"avatars" | "products" | "scripts" | "ads" | "images", number | null>;
interface ClipRow { id: string; kind: string | null; model: string | null; url: string | null; status: string; created_at: string; prompt?: string | null }

const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const WEEKDAY = ["D", "L", "M", "M", "J", "V", "S"];
const kindLabel = (k: string | null) => (k === "gen:image" ? "Imagen" : k?.startsWith("tool:") ? "Herramienta" : k === "gen:video" ? "Video" : "Corte de anuncio");
const isVideo = (u: string | null) => Boolean(u && /\.(mp4|webm|mov)(\?|$)/i.test(u));

interface Step { n: number; title: string; text: string; href: string; cta: string; done: boolean; optional?: boolean }

export default function Home({ full = true }: { full?: boolean }) {
  const [c, setC] = useState<Counts | null>(null);
  const [voices, setVoices] = useState<number | null>(null);
  const [missing, setMissing] = useState(false);
  const [working, setWorking] = useState<{ id: string; title: string | null; format: string | null; status: string }[]>([]);
  const [clips, setClips] = useState<ClipRow[] | null>(null);
  const { info } = useCredits();

  useEffect(() => {
    const tables = ["avatars", "products", "scripts", "ads", "images"] as const;
    Promise.all(tables.map((t) => fetch(`/api/data/${t}?count=1`).then(async (r) => ({ t, ok: r.ok, d: await r.json().catch(() => ({})) })).catch(() => ({ t, ok: false, d: {} as Record<string, unknown> }))))
      .then((all) => {
        if (all.some((x) => !x.ok)) setMissing(true);
        setC(Object.fromEntries(all.map((x) => [x.t, x.ok ? Number(x.d.count ?? 0) : null])) as Counts);
      });
    // ads still being made: a way back to them right from the start page
    fetch("/api/data/ads").then((r) => (r.ok ? r.json() : null)).then((d) => setWorking(((d?.rows ?? []) as { id: string; title: string | null; format: string | null; status: string }[]).filter((a) => a.status !== "done" && a.status !== "draft").slice(0, 3))).catch(() => {});
    fetch("/api/data/clips").then((r) => (r.ok ? r.json() : null)).then((d) => setClips(((d?.rows ?? []) as ClipRow[]))).catch(() => {});
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


  return (
    <>
      <PageHead title={starting ? "Bienvenido a Creads" : "Qué hacer hoy"} lead={starting ? "Sigue estos pasos en orden. Los primeros se hacen una sola vez; después, cada anuncio es guion → anuncio." : "Crea tus anuncios, revisa cómo avanzan y guarda los terminados."} />
      {missing && <SetupNotice />}
      {working.length > 0 && (
        <section aria-label="Anuncios en producción" className="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-accent/[0.06] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-sm">{working.length === 1 ? "Tienes un anuncio en producción" : `Tienes ${working.length} anuncios en producción`}</b>
            <Link href="/app/videos" className="text-sm font-semibold text-accent-text underline">Ver todos</Link>
          </div>
          <ul className="flex flex-col gap-1.5">
            {working.map((a) => (
              <li key={a.id}>
                <Link href={a.format === "historia" ? `/app/historias?id=${a.id}` : `/app/videos/${a.id}`} className="flex items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2.5 text-sm hover:bg-surface-2">
                  <span className="min-w-0 truncate font-semibold">{a.title || "Anuncio sin título"}</span>
                  <span className="shrink-0 text-xs font-semibold text-accent-text">{a.status === "failed" ? "Tiene cortes con error · " : a.status === "review" ? "Listo para revisar · " : "Generando · "}Volver →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {starting ? (
        <section className={cardCls} aria-labelledby="pasos" data-tour="primeros-pasos">
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
          {full && <p className="text-xs text-muted">¿Necesitas imágenes para tus anuncios? Créalas en <Link href="/app/laboratorio" className="font-semibold text-accent-text underline">Imágenes para anuncios</Link>.</p>}
        </section>
      ) : (
        c && <Dashboard c={c} clips={clips} working={working.length} full={full} balance={info?.unlimited ? null : info?.balance ?? null} plan={info?.plan ?? null} paidUntil={info?.paidUntil ?? null} unlimited={!!info?.unlimited} rate={info?.rate} />
      )}

      {full && !starting && c && (
        <section className={cardCls} aria-labelledby="quick">
          <h2 id="quick" className="font-display text-lg font-bold">Imágenes para tus anuncios</h2>
          <p className="text-sm text-muted">Con la misma idea de tu video, crea varias imágenes para el feed (4:5) con tu avatar o tu producto.</p>
          <Link href="/app/laboratorio" className="w-fit rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-muted">Crear imágenes</Link>
        </section>
      )}
    </>
  );
}

/** The studio's start page once the account is set up: what you have, what you made this week, what's next. */
function Dashboard({ c, clips, working, full, balance, plan, paidUntil, unlimited, rate }: {
  c: Counts; clips: ClipRow[] | null; working: number; full: boolean; balance: number | null; plan: string | null; paidUntil: string | null; unlimited: boolean; rate?: number;
}) {
  const now = new Date();
  const days = Array.from({ length: 7 }, (_, i) => new Date(now.getTime() - (6 - i) * DAY));
  const done = (clips ?? []).filter((x) => x.status === "done");
  const perDay = days.map((d) => done.filter((x) => x.created_at.slice(0, 10) === dayKey(d)).length);
  const week = perDay.reduce((a, b) => a + b, 0);
  const top = Math.max(1, ...perDay);
  const recent = done.filter((x) => x.url).slice(0, 6);
  // what the balance still makes: a 30 s ad ≈ 46 credits economic, ≈ 154 with Veo Fast / Seedance
  const secs = balance == null ? null : secondsOf(balance, rate);
  const ads = secs == null ? null : { eco: adsOf(secs), rec: Math.floor(secs / 120) };
  const until = paidUntil ? new Date(paidUntil).toLocaleDateString("es-CL", { day: "numeric", month: "long" }) : null;

  const stats: [string, number | null, string][] = [
    ["Anuncios", c.ads, "/app/biblioteca"],
    ["En producción", working, "/app/videos"],
    ["Guiones", c.scripts, "/app/guiones"],
    ["Imágenes", c.images, "/app/biblioteca"],
    ["Avatares", c.avatars, "/app/avatares"],
  ];

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[1.1fr_1fr]">
        {/* credits */}
        <section aria-label="Tus segundos de video" className="rounded-2xl bg-[image:var(--grad)] p-[1px]">
          <div className="flex h-full flex-col justify-between gap-4 rounded-[15px] bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm text-muted">Tus segundos de video{plan ? ` · Plan ${plan}` : ""}</span>
                <b className="font-display text-4xl font-bold tabular-nums">{unlimited ? "Ilimitados" : secs == null ? "—" : fmtSeconds(secs)}</b>
                {until && !unlimited && <span className="text-xs text-muted">Tu plan se renueva el {until}</span>}
              </div>
              <Link href="/app/planes" className="shrink-0 rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2">Recargar</Link>
            </div>
            {ads && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl bg-surface-2 p-3"><b className="font-display text-2xl tabular-nums">≈ {ads.eco}</b><span className="block text-xs text-muted">anuncios de 30 s con avatar que habla</span></div>
                <div className="rounded-xl bg-surface-2 p-3"><b className="font-display text-2xl tabular-nums">≈ {ads.rec}</b><span className="block text-xs text-muted">con Veo 3.1 (máxima calidad)</span></div>
              </div>
            )}
          </div>
        </section>

        {/* this week */}
        <section aria-label="Tu semana" className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-surface p-5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-muted">Esta semana</span>
            <span className="text-sm"><b className="font-display text-2xl tabular-nums">{clips ? week : "—"}</b> {week === 1 ? "creación" : "creaciones"}</span>
          </div>
          <div className="flex h-24 items-end gap-2" role="img" aria-label={`Creaciones por día en los últimos 7 días: ${perDay.join(", ")}`}>
            {perDay.map((n, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-muted">{n || ""}</span>
                <span className="w-full rounded-t-md" style={{ height: `${Math.max(6, (n / top) * 64)}px`, background: i === 6 ? "var(--grad)" : n ? "var(--accent-text)" : "var(--surface-2)", opacity: i === 6 || !n ? 1 : 0.55 }} />
                <span className="text-[10px] text-muted">{WEEKDAY[days[i].getDay()]}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">{week === 0 ? "Tu primera creación de la semana está a un clic." : week >= 10 ? "¡Vas con todo! Prueba tus mejores ganchos en varias versiones." : "Cada versión nueva es otra oportunidad de encontrar el anuncio ganador."}</p>
        </section>
      </div>

      {/* next ad */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex max-w-xl flex-col gap-1">
          <h2 className="font-display text-lg font-bold">Haz tu próximo anuncio</h2>
          <p className="text-sm text-muted">Mira qué está funcionando en tu nicho, conviértelo en un guion mejor y créalo en el formato que quieras.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {full && <Link href="/app/spy" className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">1 · Espiar</Link>}
          <Link href="/app/guiones" className="rounded-xl border border-line px-4 py-2.5 text-sm font-semibold hover:bg-surface-2">{full ? "2" : "1"} · Crear guion</Link>
          <Link href="/app/crear" className="rounded-xl bg-[image:var(--grad)] px-4 py-2.5 text-sm font-semibold text-white">{full ? "3" : "2"} · Crear anuncio</Link>
        </div>
      </section>

      {/* numbers */}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Tu cuenta">
        {stats.map(([label, n, href]) => (
          <li key={label}>
            <Link href={href} className="flex flex-col gap-0.5 rounded-xl border border-line bg-surface px-4 py-3 transition-colors hover:border-accent/60">
              <b className="font-display text-2xl tabular-nums">{n == null ? "—" : n}</b>
              <span className="text-sm text-muted">{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      {/* last made */}
      {recent.length > 0 && (
        <section aria-labelledby="recientes" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="recientes" className="font-display text-lg font-bold">Lo último que hiciste</h2>
            <Link href="/app/biblioteca" className="text-sm text-accent-text">Ver todo →</Link>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {recent.map((x) => (
              <li key={x.id} className="flex flex-col gap-1">
                <a href={x.url!} target="_blank" rel="noopener" className="relative block aspect-[9/16] overflow-hidden rounded-xl border border-line bg-surface-2">
                  {isVideo(x.url)
                    ? <video src={`${x.url}#t=0.5`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                    : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={x.url!} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                </a>
                <span className="truncate text-xs text-muted">{kindLabel(x.kind)}{x.model ? ` · ${x.model}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
