"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { findTool, TOOLS } from "@/lib/tools";
import { cardCls, Empty, SetupNotice, Working } from "./ui";
import { useCredits } from "./use-credits";

// The "Crear" menu: generators first, then the one-click tools, then everything you've made with them.

interface Job { id: string; kind: string; status: string; url: string | null; image_url: string | null; created_at: string; usd: number | null; model: string | null; provider_job: string | null }

const GENERATE = [
  { href: "/app/laboratorio", name: "Video IA", short: "Un clip desde texto o desde una imagen.", models: "Veo 3.1 · Kling 3.0 · Seedance 2.5 · Hailuo 2.3 · Wan 3.0 · Grok" },
  { href: "/app/laboratorio", name: "Imagen IA", short: "Fotos realistas, producto y escenas.", models: "Nano Banana Pro · Nano Banana 2 · Seedream 5 · FLUX 3" },
  { href: "/app/guiones", name: "Crear guion", short: "Desarma un guion ganador, pide ángulos y hooks, y mejóralo línea por línea.", models: "IA de guiones Creads" },
  { href: "/app/crear", name: "Anuncio completo", short: "Pega un guion y recibe el anuncio terminado y revisado.", models: "El modelo de video que elijas" },
  { href: "/app/voces", name: "Voz IA", short: "Clona tu voz o elige una y haz que lea tu texto.", models: "ElevenLabs" },
];

const ICON: Record<string, string> = {
  "quitar-fondo": "M4 5h16v14H4zM9 15l3-4 3 4M8 8.5h.01",
  "editar-imagen": "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  "mejorar-imagen": "M4 4h7v7H4zM13 13h7v7h-7zM14 4h6v6M10 20H4v-6",
  "mejorar-video": "M4 6h12v12H4zM16 10l4-2v8l-4-2M7 9h3M7 12h6",
  "editar-video": "M3 6h12v12H3zM15 10l4-2v8l-4-2M6 15l5-5 2 2",
  "copiar-movimiento": "M8 4a2 2 0 1 0 0 .01M6 21l2-6 3 2v4M8 15l-1-5 4-2 3 3h3M16 4a2 2 0 1 0 0 .01",
  "personaje-en-video": "M9 7a3 3 0 1 0 0 .01M4 20c0-3 2.2-5 5-5s5 2 5 5M15 8h6M18 5v6",
  "avatar-habla": "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 9-6.7M17 15v5M20 16.5v2M14 16.5v2",
  "sincronizar-labios": "M4 12c2.5-3 5-4.5 8-4.5s5.5 1.5 8 4.5c-2.5 3-5 4.5-8 4.5S6.5 15 4 12ZM4 12h16",
  doblaje: "M4 5h9v6H8l-4 3V5ZM11 13v2h5l4 3v-9h-4",
  musica: "M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM19 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  efectos: "M3 12h2l2-5 3 10 3-14 3 12 2-3h3",
};

function Glyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function ToolsHub() {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [missing, setMissing] = useState(false);
  const { info, price } = useCredits();
  const priceOf = (t: (typeof TOOLS)[number]) => (info?.unlimited ? t.priceNote : `desde ${price(t.estimate(0))}`);
  useEffect(() => {
    let alive = true;
    fetch("/api/tools").then((r) => r.json()).then((d) => {
      if (!alive) return;
      setMissing(Boolean(d.missingTable));
      const rows: Job[] = d.rows ?? [];
      setJobs(rows);
      // Jobs still marked as running (the tab was closed): ask once more, which also saves finished ones.
      rows.filter((j) => j.status === "running").slice(0, 8).forEach((j) => {
        const url = j.kind === "gen:video"
          ? j.model && j.provider_job ? `/api/generate/video?model=${encodeURIComponent(j.model)}&job=${encodeURIComponent(j.provider_job)}` : ""
          : j.kind.startsWith("tool:") ? `/api/tools/${j.kind.slice(5)}?id=${j.id}` : "";
        if (!url) return;
        fetch(url).then((r) => r.json()).then((st) => {
          if (!alive || (st.state !== "done" && st.state !== "failed")) return;
          setJobs((js) => js && js.map((x) => (x.id === j.id ? { ...x, status: st.state, url: st.url ?? x.url } : x)));
        }).catch(() => {});
      });
    }).catch(() => setJobs([]));
    return () => { alive = false; };
  }, []);

  return (
    <div className="flex flex-col gap-10">
      <Link href="/app/recrear" className="flex flex-col gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-5 transition-colors hover:border-accent sm:flex-row sm:items-center sm:justify-between">
        <span className="flex flex-col gap-1">
          <b className="font-display text-lg font-semibold">↻ Recrear un video</b>
          <span className="text-sm text-muted">Elige un anuncio que funciona y hazlo tuyo: cambia la persona, el producto o el lugar, o haz que tu personaje copie sus movimientos.</span>
        </span>
        <span className="shrink-0 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink sm:self-auto">Ver ejemplos</span>
      </Link>
      <section aria-labelledby="gen" className="flex flex-col gap-3">
        <h2 id="gen" className="text-lg font-semibold">Generar</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {GENERATE.map((g) => (
            <Link key={g.name} href={g.href} className="group flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-muted/60">
              <b className="font-display text-lg font-semibold">{g.name}</b>
              <span className="text-sm text-muted">{g.short}</span>
              <span className="mt-auto pt-2 font-mono text-[11px] text-muted">{g.models}</span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="edit" className="flex flex-col gap-3">
        <h2 id="edit" className="text-lg font-semibold">Editar y mejorar</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.filter((t) => t.output !== "audio").map((t) => (
            <Link key={t.id} href={t.id === "crear-personaje" ? "/app/influencer/nuevo" : `/app/herramientas/${t.id}`} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-muted/60">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent-text"><Glyph d={ICON[t.id]} /></span>
              <span className="flex min-w-0 flex-col gap-1">
                <b className="font-semibold">{t.name}</b>
                <span className="text-sm text-muted">{t.short}</span>
                <span className="text-xs text-muted">{t.model} · {priceOf(t)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="audio" className="flex flex-col gap-3">
        <h2 id="audio" className="text-lg font-semibold">Audio</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TOOLS.filter((t) => t.output === "audio").map((t) => (
            <Link key={t.id} href={t.id === "crear-personaje" ? "/app/influencer/nuevo" : `/app/herramientas/${t.id}`} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-muted/60">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent-text"><Glyph d={ICON[t.id]} /></span>
              <span className="flex min-w-0 flex-col gap-1">
                <b className="font-semibold">{t.name}</b>
                <span className="text-sm text-muted">{t.short}</span>
                <span className="text-xs text-muted">{t.model} · {priceOf(t)}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="mine" className={cardCls}>
        <h2 id="mine" className="text-lg font-semibold">Tus creaciones</h2>
        {missing ? <SetupNotice /> : jobs === null ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : jobs.length === 0 ? (
          <Empty title="Todavía no has usado las herramientas" text="Lo que crees aquí queda guardado, aunque cierres la página." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {jobs.map((j) => {
              const t = j.kind === "gen:video" ? { id: "video", name: "Video IA", href: "/app/laboratorio" }
                : j.kind === "gen:image" ? { id: "image", name: "Imagen IA", href: "/app/laboratorio" }
                : (() => { const x = findTool(j.kind.replace(/^tool:/, "")); return x && { id: x.id, name: x.name, href: `/app/herramientas/${x.id}` }; })();
              if (!t) return null;
              const thumb = j.url ?? j.image_url;
              const isVid = thumb && /\.(mp4|mov|webm)$/i.test(thumb);
              const isAudio = thumb && /\.(mp3|wav|m4a)$/i.test(thumb);
              return (
                <Link key={j.id} href={j.url ? j.url : t.href} target={j.url ? "_blank" : undefined} className="flex flex-col gap-1.5">
                  <span className="relative aspect-square overflow-hidden rounded-xl border border-line bg-surface-2">
                    {isAudio ? <span className="grid h-full place-items-center text-2xl text-muted" aria-hidden="true">♪</span> : thumb && (isVid
                      ? <video src={thumb} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={thumb} alt="" loading="lazy" className="h-full w-full object-cover" />)}
                    {j.status !== "done" && (
                      <span className={`absolute inset-x-1.5 bottom-1.5 rounded-md bg-black/70 px-2 py-1 text-center text-[11px] font-semibold ${j.status === "failed" ? "text-bad" : "text-white"}`}>
                        {j.status === "failed" ? "Falló" : <Working since={j.created_at} label="" />}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted">{t.name}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
