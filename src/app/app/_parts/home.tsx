"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHead, SetupNotice, cardCls } from "./ui";
import { useCredits } from "./use-credits";

// Inicio (owner's brief, 25 Oct 2026 — «interfaz interna ordenada»): what the balance still makes, in pieces;
// Automático and Manual first (owner, 26 Oct 2026); the other things to create; what's being made and the latest ads; and ONE
// suggested next step. A 3-step welcome guide replaces all that on the first visit (no ads yet).

interface ClipRow { id: string; kind: string | null; url: string | null; status: string; created_at: string }
interface AdRow { id: string; title: string | null; format: string | null; status: string }

const isVideo = (u: string | null) => Boolean(u && /\.(mp4|webm|mov)(\?|$)/i.test(u));
/** Credits each piece uses (the same numbers as the plans page). */
const PIEZA = { imagen: 10, producto: 30, avatar: 120 } as const;

const CREAR = [
  { href: "/app/tanda", title: "Imágenes de anuncio", text: "10 anuncios desde el link de tu producto, en 4:5, 9:16 y cuadrado.", ico: "🖼️" },
  { href: "/app/video-producto", title: "Video de producto", text: "Tu producto en movimiento, 6 segundos, sin grabar.", ico: "🎬" },
  { href: "/app/laboratorio", title: "Imagen a medida", text: "Describe la imagen que quieres y Creads la hace.", ico: "✨" },
] as const;

/** The two ways to make a video ad, first thing on the page (owner, 26 Oct 2026: «que aparezca nuevamente el automático y manual»). */
function DosCaminos() {
  return (
    <section aria-label="Crea tu anuncio en video" data-tour="primeros-pasos" className="grid gap-3 md:grid-cols-2">
      <Link href="/app/automatico" className="group relative flex flex-col gap-3 overflow-hidden rounded-2xl border-2 border-transparent p-5 [background:linear-gradient(var(--surface),var(--surface))_padding-box,var(--grad)_border-box] transition-transform hover:-translate-y-0.5 motion-reduce:transition-none">
        <span className="flex items-center justify-between gap-2">
          <b className="font-display text-2xl font-semibold">Automático</b>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-0.5 text-[13px] font-bold">Con avatar</span>
        </span>
        <p className="text-[15px] text-muted">Conversas con Creads: te pregunta lo necesario, escribe el guion, crea a la persona, hace el video, lo revisa palabra por palabra y te lo entrega listo.</p>
        <ol className="hidden flex-wrap gap-1.5 text-[13px] font-semibold sm:flex">
          {["Preguntas", "Guion", "Persona", "Video", "Revisión", "Listo"].map((x, i) => <li key={x} className="rounded-full bg-surface-2 px-2.5 py-1">{i + 1}. {x}</li>)}
        </ol>
        <span className="mt-auto w-full rounded-xl bg-[image:var(--grad)] px-4 py-3 text-center text-[15px] font-semibold text-white sm:w-fit sm:py-2.5 sm:text-sm">Hacer mi anuncio conversando</span>
      </Link>
      <Link href="/app/crear" className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-muted">
        <span className="flex items-center justify-between gap-2">
          <b className="font-display text-2xl font-semibold">Manual</b>
          <span className="shrink-0 whitespace-nowrap rounded-full border border-line px-2.5 py-0.5 text-[13px] font-bold text-muted">Paso a paso</span>
        </span>
        <p className="text-[15px] text-muted">Tú decides cada detalle: guion, persona, voz, escenas, videos y edición.</p>
        <ol className="hidden flex-wrap gap-1.5 text-[13px] font-semibold text-muted sm:flex">
          {["Guion", "Persona", "Voz", "Escenas", "Videos", "Edición"].map((x, i) => <li key={x} className="rounded-full border border-line px-2.5 py-1">{i + 1}. {x}</li>)}
        </ol>
        <span className="mt-auto w-full rounded-xl border border-line px-4 py-3 text-center text-[15px] font-semibold sm:w-fit sm:py-2.5 sm:text-sm">Hacerlo paso a paso</span>
      </Link>
    </section>
  );
}

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
    : (tandas ?? 0) === 0 ? { title: "Haz tus primeros anuncios de imagen", text: "Pega el link de tu producto y en minutos tienes 10 anuncios para testear.", href: "/app/tanda", cta: "Crear anuncios" }
    : !done.some((x) => isVideo(x.url)) ? { title: "Suma un video de producto", text: "Los videos cortos del producto en movimiento suelen ganarle a la imagen fija en reels.", href: "/app/video-producto", cta: "Hacer un video" }
    : { title: "Multiplica tu ganador", text: "Marca el anuncio que mejor te funcionó y pide 10 variaciones con hooks nuevos.", href: "/app/biblioteca", cta: "Ver mis anuncios" };

  return (
    <>
      <PageHead title={firstTime ? "Bienvenido a Creads" : "Inicio"} lead={firstTime ? "Elige cómo quieres hacer tu primer anuncio: conversando con Creads o paso a paso." : "Crea, revisa lo que está en producción y descarga lo terminado."} />
      {missing && <SetupNotice />}

      {!firstTime && (
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

        </>
      )}

      <DosCaminos />

      {/* the other things to create */}
      <h2 className="-mb-1 font-display text-lg font-bold">También puedes crear</h2>
      <nav aria-label="También puedes crear" className="grid gap-3 sm:grid-cols-3">
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
