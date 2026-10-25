"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHead, SetupNotice, cardCls } from "./ui";
import { useCredits } from "./use-credits";

// Inicio (owner's brief, 25 Oct 2026 — «interfaz interna ordenada»): what the balance still makes, in pieces;
// one big «Crear nueva tanda»; the three ways to create; what's being made and the latest ads; and ONE
// suggested next step. A 3-step welcome guide replaces all that on the first visit (no ads yet).

interface ClipRow { id: string; kind: string | null; url: string | null; status: string; created_at: string }
interface AdRow { id: string; title: string | null; format: string | null; status: string }

const isVideo = (u: string | null) => Boolean(u && /\.(mp4|webm|mov)(\?|$)/i.test(u));
/** Credits each piece uses (the same numbers as the plans page). */
const PIEZA = { imagen: 10, producto: 30, avatar: 120 } as const;

const CREAR = [
  { href: "/app/tanda", title: "Imágenes", text: "10 anuncios desde el link de tu producto, en 4:5, 9:16 y cuadrado.", ico: "🖼️" },
  { href: "/app/video-producto", title: "Video de producto", text: "Tu producto en movimiento, 6 segundos, sin grabar.", ico: "🎬" },
  { href: "/app/automatico", title: "Video con avatar", text: "Una persona que habla de tu producto, con voz y subtítulos.", ico: "🗣️" },
] as const;

export default function Home({ full = true }: { full?: boolean }) {
  const [ads, setAds] = useState<AdRow[] | null>(null);
  const [clips, setClips] = useState<ClipRow[] | null>(null);
  const [tandas, setTandas] = useState<number | null>(null);
  const [marca, setMarca] = useState<boolean | null>(null);
  const [missing, setMissing] = useState(false);
  const { info } = useCredits();

  useEffect(() => {
    fetch("/api/data/ads").then((r) => { if (!r.ok) setMissing(true); return r.ok ? r.json() : null; }).then((d) => setAds((d?.rows ?? []) as AdRow[])).catch(() => setAds([]));
    fetch("/api/data/clips").then((r) => (r.ok ? r.json() : null)).then((d) => setClips((d?.rows ?? []) as ClipRow[])).catch(() => setClips([]));
    fetch("/api/tanda").then((r) => (r.ok ? r.json() : null)).then((d) => setTandas(Array.isArray(d?.tandas) ? d.tandas.length : 0)).catch(() => setTandas(0));
    fetch("/api/marca").then((r) => (r.ok ? r.json() : null)).then((d) => setMarca(Boolean(d?.marca?.nombre?.trim()))).catch(() => setMarca(false));
  }, []);

  const loaded = ads !== null && clips !== null && tandas !== null;
  const done = (clips ?? []).filter((x) => x.status === "done" && x.url);
  const working = (ads ?? []).filter((a) => a.status !== "done" && a.status !== "draft").slice(0, 3);
  const firstTime = loaded && (tandas ?? 0) === 0 && done.length === 0 && (ads ?? []).length === 0;

  const balance = info?.unlimited ? null : info?.balance ?? null;
  const piezas = balance == null ? null : { imagen: Math.floor(balance / PIEZA.imagen), producto: Math.floor(balance / PIEZA.producto), avatar: Math.floor(balance / PIEZA.avatar) };
  const until = info?.paidUntil ? new Date(info.paidUntil).toLocaleDateString("es-CL", { day: "numeric", month: "long" }) : null;

  // one suggestion, the most useful next thing for this account
  const siguiente = !loaded ? null
    : marca === false ? { title: "Arma tu kit de marca", text: "Logo, colores y tono una sola vez: todo lo que crees sale con tu marca.", href: "/app/marca", cta: "Armar mi kit" }
    : (tandas ?? 0) === 0 ? { title: "Haz tu primera tanda", text: "Pega el link de tu producto y en minutos tienes 10 anuncios para testear.", href: "/app/tanda", cta: "Crear tanda" }
    : !done.some((x) => isVideo(x.url)) ? { title: "Suma un video de producto", text: "Los videos cortos del producto en movimiento suelen ganarle a la imagen fija en reels.", href: "/app/video-producto", cta: "Hacer un video" }
    : { title: "Multiplica tu ganador", text: "Marca el anuncio que mejor te funcionó y pide 10 variaciones con hooks nuevos.", href: "/app/tanda", cta: "Ver mis tandas" };

  return (
    <>
      <PageHead title={firstTime ? "Bienvenido a Creads" : "Inicio"} lead={firstTime ? "Tres pasos y tienes tus primeros anuncios listos para Meta." : "Crea, revisa lo que está en producción y descarga lo terminado."} />
      {missing && <SetupNotice />}

      {firstTime ? (
        <section className={cardCls} aria-labelledby="bienvenida" data-tour="primeros-pasos">
          <h2 id="bienvenida" className="font-display text-lg font-bold">Así funciona</h2>
          <ol className="grid gap-3 md:grid-cols-3">
            {[
              ["Pega el link de tu producto", "Creads lee qué vendes, a quién y la foto del producto. Si no tienes página, lo describes en dos frases."],
              ["Elige tus ángulos", "Te propone ángulos de venta con sus hooks. Marcas los que quieres testear. No gasta saldo."],
              ["Descarga o edita", "Recibes tus anuncios en 4:5, 9:16 y cuadrado, en un ZIP y con el archivo para importarlos en Meta."],
            ].map(([t, x], i) => (
              <li key={t} className="flex flex-col gap-1.5 rounded-xl border border-line p-4">
                <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-[image:var(--grad)] text-sm font-bold text-white">{i + 1}</span>
                <b className="text-[15px]">{t}</b>
                <span className="text-sm text-muted">{x}</span>
              </li>
            ))}
          </ol>
          <Link href="/app/tanda" className="w-full rounded-xl bg-[image:var(--grad)] px-5 py-3.5 text-center text-base font-semibold text-white sm:w-fit">Empezar mi primera tanda</Link>
        </section>
      ) : (
        <>
          {/* balance, in pieces */}
          <section aria-label="Tu saldo" className="rounded-2xl bg-[image:var(--grad)] p-[1px]">
            <div className="flex flex-col gap-4 rounded-[15px] bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm text-muted">Te quedan{info?.plan ? ` · Plan ${info.plan}` : ""}</span>
                {info?.unlimited ? <b className="font-display text-2xl font-bold">Sin límite</b> : piezas ? (
                  <b className="font-display text-xl leading-snug font-bold sm:text-2xl">{piezas.imagen} imágenes <span className="text-muted">o</span> {piezas.producto} videos de producto <span className="text-muted">o</span> {piezas.avatar} videos con avatar</b>
                ) : <b className="font-display text-2xl">—</b>}
                {until && !info?.unlimited && <span className="text-[13px] text-muted">Tu plan se renueva el {until}. {balance} créditos.</span>}
              </div>
              <Link href="/app/planes" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-line px-4 font-semibold hover:bg-surface-2">Saldo y plan</Link>
            </div>
          </section>

          <Link href="/app/tanda" className="flex min-h-14 items-center justify-center rounded-2xl bg-[image:var(--grad)] px-5 py-4 text-center font-display text-lg font-semibold text-white shadow-[0_12px_32px_-12px_rgba(255,43,214,0.7)]">Crear nueva tanda</Link>
        </>
      )}

      {/* the three ways to create */}
      <nav aria-label="Crear" className="grid gap-3 sm:grid-cols-3">
        {CREAR.filter((c) => full || c.href !== "/app/tanda").map((c) => (
          <Link key={c.href} href={c.href} className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-muted">
            <span aria-hidden="true" className="text-2xl">{c.ico}</span>
            <span className="flex flex-col gap-0.5"><b>{c.title}</b><span className="text-sm text-muted">{c.text}</span></span>
          </Link>
        ))}
      </nav>

      {working.length > 0 && (
        <section aria-label="En producción" className="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-accent/[0.06] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <b className="text-sm">{working.length === 1 ? "Tienes un anuncio en producción" : `Tienes ${working.length} anuncios en producción`}</b>
            <Link href="/app/videos" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text underline">Ver todos</Link>
          </div>
          <ul className="flex flex-col gap-1.5">
            {working.map((a) => (
              <li key={a.id}>
                <Link href={a.format === "historia" ? `/app/historias?id=${a.id}` : `/app/videos/${a.id}`} className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-surface px-3 py-2.5 text-sm hover:bg-surface-2">
                  <span className="min-w-0 truncate font-semibold">{a.title || "Anuncio sin título"}</span>
                  <span className="shrink-0 text-[13px] font-semibold text-accent-text">{a.status === "failed" ? "Tiene cortes con error" : a.status === "review" ? "Listo para revisar" : "Generando"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {siguiente && !firstTime && (
        <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between" aria-labelledby="siguiente">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-accent-text">Siguiente paso sugerido</span>
            <h2 id="siguiente" className="font-display text-lg font-bold">{siguiente.title}</h2>
            <p className="text-sm text-muted">{siguiente.text}</p>
          </div>
          <Link href={siguiente.href} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-ink px-4 font-semibold text-bg">{siguiente.cta}</Link>
        </section>
      )}

      {done.length > 0 && (
        <section aria-labelledby="recientes" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="recientes" className="font-display text-lg font-bold">Tus últimos anuncios</h2>
            <Link href="/app/biblioteca" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent-text">Ver todos</Link>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {done.slice(0, 6).map((x) => (
              <li key={x.id}>
                <a href={x.url!} target="_blank" rel="noopener" className="relative block aspect-[9/16] overflow-hidden rounded-xl border border-line bg-surface-2">
                  {isVideo(x.url)
                    ? <video src={`${x.url}#t=0.5`} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                    : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={x.url!} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    )}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
