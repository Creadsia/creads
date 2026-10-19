"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { type Example, exampleHref, KIND_LABEL, thumb } from "@/lib/examples";

// Example galleries: big thumbnails, clips that play on hover (desktop) or while on screen (phones),
// a detail view and «Crear algo similar». Choosing an example never generates anything.

const RATIO: Record<Example["aspect"], string> = { "9:16": "aspect-[9/16]", "4:5": "aspect-[4/5]", "1:1": "aspect-square", "16:9": "aspect-video" };

/** A clip that downloads only when needed: on hover with a mouse, while visible on touch screens. */
export function PreviewVideo({ src, poster, className = "", active }: { src: string; poster?: string; className?: string; active?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    setTouch(window.matchMedia("(hover: none)").matches);
  }, []);
  // phones: play while mostly on screen
  useEffect(() => {
    const el = ref.current;
    if (!el || !touch || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.intersectionRatio > 0.6) { setLoad(true); el.play().catch(() => {}); } else el.pause();
    }, { threshold: [0, 0.6] });
    io.observe(el);
    return () => io.disconnect();
  }, [touch]);
  // mouse: play while hovered (the parent says so)
  useEffect(() => {
    const el = ref.current;
    if (!el || touch) return;
    if (active) { setLoad(true); requestAnimationFrame(() => el.play().catch(() => {})); } else { el.pause(); }
  }, [active, touch]);
  // no still: show the clip's first frame (only its metadata downloads until it plays)
  const eager = !poster;
  return <video ref={ref} className={className} poster={poster} src={load ? src : eager ? `${src}#t=0.1` : undefined} muted loop playsInline preload={eager ? "metadata" : "none"} aria-hidden="true" />;
}

function Media({ e, active, sizes = 384 }: { e: Example; active?: boolean; sizes?: number }) {
  const poster = e.still ? thumb(e.still, sizes) : undefined;
  if (e.video) return <PreviewVideo src={e.video} poster={poster} active={active} className="absolute inset-0 h-full w-full object-cover" />;
  // eslint-disable-next-line @next/next/no-img-element
  return poster ? <img src={poster} alt="" loading="lazy" decoding="async" onError={(ev) => { ev.currentTarget.style.visibility = "hidden"; }} className="absolute inset-0 h-full w-full object-cover" /> : null;
}

export function ExampleTile({ e, onOpen, showKind }: { e: Example; onOpen: (e: Example) => void; showKind?: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onOpen(e)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className={`group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-surface-2 text-left outline-offset-2 ${RATIO[e.aspect]}`}
      aria-label={`${e.title} · ${e.modelLabel}. Ver ejemplo`}
    >
      <Media e={e} active={hover} />
      {e.video && <span aria-hidden="true" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-opacity group-hover:opacity-0">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
      </span>}
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-10 text-white">
        <b className="text-sm leading-tight">{e.title}</b>
        <span className="text-xs text-white/75">{showKind ? `${KIND_LABEL[e.kind]} · ` : ""}{e.modelLabel}</span>
      </span>
    </button>
  );
}

/** The example up close: what it is, how it was made, and «Crear algo similar». */
export function ExampleDetail({ e, onClose, onUse }: { e: Example; onClose: () => void; onUse?: (e: Example) => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const key = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = prev; };
  }, [onClose]);
  const facts: [string, string][] = [
    ["Tipo", `${KIND_LABEL[e.kind]} · ${e.tag}`],
    ["Hecho con", e.modelLabel],
    ["Formato", e.aspect],
    ...(e.seconds ? [["Duración", `${e.seconds} s`] as [string, string]] : []),
  ];
  const cta = e.kind === "video" || e.kind === "imagen" ? "Crear algo similar" : `Ir a ${KIND_LABEL[e.kind]}`;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={e.title}>
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative grid max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl border border-line bg-surface sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:rounded-3xl">
        <div className={`relative w-full bg-black sm:h-full ${e.aspect === "16:9" ? "aspect-video" : "aspect-[4/5] sm:aspect-auto sm:min-h-[460px]"}`}>
          {e.video
            ? <video src={e.video} poster={e.still ? thumb(e.still, 750) : undefined} autoPlay muted loop playsInline controls className="absolute inset-0 h-full w-full object-contain" />
            // eslint-disable-next-line @next/next/no-img-element
            : e.still && <img src={thumb(e.still, 750)} alt={e.title} className="absolute inset-0 h-full w-full object-contain" />}
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-semibold leading-tight">{e.title}</h2>
            <button ref={close} type="button" onClick={onClose} aria-label="Cerrar" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line text-muted hover:text-ink">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {facts.map(([k, v]) => (<Fragment key={k}><dt className="text-muted">{k}</dt><dd className="font-semibold">{v}</dd></Fragment>))}
          </dl>
          {e.idea && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-muted">Idea para partir</span>
              <p className="rounded-xl bg-surface-2 p-3 text-sm leading-relaxed">{e.idea}</p>
            </div>
          )}
          <div className="mt-auto flex flex-col gap-2 pt-2">
            {onUse
              ? <button type="button" onClick={() => onUse(e)} className="rounded-xl bg-[image:var(--grad)] px-4 py-3 text-sm font-semibold text-white">{cta}</button>
              : <Link href={exampleHref(e)} className="rounded-xl bg-[image:var(--grad)] px-4 py-3 text-center text-sm font-semibold text-white">{cta}</Link>}
            <p className="text-center text-xs text-muted">{onUse ? "Copia la configuración en el panel. No genera nada ni usa créditos." : "Te lleva al estudio con todo listo. No usa créditos."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A filterable, paged wall of examples (masonry: every piece keeps its real format). */
export function Gallery({ examples, filterBy = "tag", onUse, showKind, columns = "columns-2 sm:columns-3 xl:columns-4", pageSize = 12 }: {
  examples: Example[];
  filterBy?: "tag" | "model" | "kind" | null;
  onUse?: (e: Example) => void;
  showKind?: boolean;
  columns?: string;
  pageSize?: number;
}) {
  const [filter, setFilter] = useState<string>("");
  const [shown, setShown] = useState(pageSize);
  const [open, setOpen] = useState<Example | null>(null);
  const keyOf = (e: Example) => (filterBy === "model" ? e.modelLabel : filterBy === "kind" ? KIND_LABEL[e.kind] : e.tag);
  const chips = useMemo(() => (filterBy ? [...new Set(examples.map(keyOf))] : []), [examples, filterBy]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = filter ? examples.filter((e) => keyOf(e) === filter) : examples;
  useEffect(() => setShown(pageSize), [filter, pageSize]);
  return (
    <div className="flex flex-col gap-4">
      {chips.length > 1 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filtrar ejemplos">
          {["", ...chips].map((c) => (
            <button key={c || "todo"} type="button" onClick={() => setFilter(c)} aria-pressed={filter === c}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${filter === c ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"}`}>
              {c || "Todo"}
            </button>
          ))}
        </div>
      )}
      <div className={`gap-3 ${columns}`}>
        {list.slice(0, shown).map((e) => <ExampleTile key={e.id} e={e} onOpen={setOpen} showKind={showKind} />)}
      </div>
      {list.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + pageSize)} className="mx-auto rounded-full border border-line px-4 py-2 text-sm font-semibold text-muted hover:text-ink">
          Ver más ejemplos
        </button>
      )}
      {open && <ExampleDetail e={open} onClose={() => setOpen(null)} onUse={onUse ? (e) => { setOpen(null); onUse(e); } : undefined} />}
    </div>
  );
}
