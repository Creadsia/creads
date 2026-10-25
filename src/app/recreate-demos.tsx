"use client";

import { useEffect, useRef, useState } from "react";
import type { Content } from "@/content/en";

// Landing: "Recrea cualquier video". One demo at a time shown as an equation:
// video before + your photo + one sentence = video after. Below, four talking formats with a sound
// switch (only one plays sound at a time). Videos load only when the section is on screen.

export interface RecreateMedia {
  /** Before / after videos for each tab key, and the reference photo (if the demo used one). */
  demos: Record<string, { before: string; after: string; photo?: string }>;
  voices: Record<string, string>;
}

/** Loads (and plays) a muted looping clip only once it's near the screen. */
function useOnScreen<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (c?.saveData) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return { ref, seen };
}

function Clip({ src, label, className = "", muted = true, playKey }: { src: string; label: string; className?: string; muted?: boolean; playKey?: string }) {
  const v = useRef<HTMLVideoElement>(null);
  // restart together whenever the demo changes
  useEffect(() => {
    const el = v.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {});
  }, [playKey, src]);
  useEffect(() => { if (v.current) v.current.muted = muted; }, [muted]);
  return (
    <video ref={v} src={`${src}#t=0.1`} muted={muted} loop playsInline autoPlay preload="metadata" aria-label={label}
      className={`h-full w-full bg-black object-cover ${className}`} />
  );
}

function Tag({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return (
    <span className={`absolute left-2 top-2 z-10 rounded-full px-2.5 py-1 text-[13px] font-bold leading-none ${strong ? "bg-[image:var(--grad)] text-white" : "bg-black/65 text-white/90 backdrop-blur-sm"}`}>
      {children}
    </span>
  );
}

export default function RecreateDemos({ t, media }: { t: Content["recreate"]; media: RecreateMedia }) {
  const tabs = t.tabs.filter((x) => media.demos[x.k]);
  const [k, setK] = useState(tabs[0]?.k ?? "");
  const [sound, setSound] = useState<string | null>(null);
  const stage = useOnScreen<HTMLDivElement>();
  const row = useOnScreen<HTMLDivElement>();
  const tab = tabs.find((x) => x.k === k) ?? tabs[0];
  const d = tab && media.demos[tab.k];
  if (!tab || !d) return null;

  return (
    <div className="flex flex-col gap-14">
      {/* the demo picker + the equation */}
      <div ref={stage.ref} className="stage grid gap-6 overflow-hidden rounded-3xl border border-line p-4 sm:p-6 lg:grid-cols-[230px_1fr] lg:gap-8 lg:p-8">
        <div role="tablist" aria-label={t.title} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
          {tabs.map((x) => {
            const on = x.k === tab.k;
            return (
              <button key={x.k} type="button" role="tab" aria-selected={on} onClick={() => setK(x.k)}
                className={`shrink-0 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors ${on ? "border-transparent bg-[image:var(--grad)] text-white" : "border-white/15 text-white/75 hover:border-white/40 hover:text-white"}`}>
                {x.label}
              </button>
            );
          })}
        </div>

        <div className="grid min-w-0 items-center gap-4 lg:grid-cols-[minmax(0,540px)_1fr] lg:gap-8" role="tabpanel">
          <div className="grid grid-cols-[1fr_1.3fr] items-end gap-3 sm:gap-4">
            <figure className="relative aspect-[9/16] overflow-hidden rounded-2xl opacity-90">
              <Tag>{t.before}</Tag>
              {stage.seen && <Clip src={d.before} label={t.before} playKey={tab.k} />}
            </figure>
            <figure className="relative aspect-[9/16] overflow-hidden rounded-2xl ring-2 ring-[color:var(--accent)] shadow-[0_24px_60px_-24px_rgba(255,43,214,0.6)]">
              <Tag strong>{t.after}</Tag>
              {stage.seen && <Clip src={d.after} label={t.after} playKey={tab.k} />}
            </figure>
          </div>

          {/* what the customer gave: photo + one sentence */}
          <div className="flex items-center gap-3 rounded-2xl bg-white/[0.06] p-3 text-white lg:flex-col lg:items-start lg:gap-4 lg:bg-transparent lg:p-0">
            {d.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.photo} alt={t.photo} loading="lazy" className="h-14 w-14 shrink-0 rounded-xl bg-white/10 object-cover lg:h-28 lg:w-28 lg:rounded-2xl" />
            ) : (
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-dashed border-white/25 text-center text-[13px] leading-tight text-white/60 lg:h-28 lg:w-28 lg:rounded-2xl lg:text-xs">{t.noPhoto}</span>
            )}
            <span aria-hidden="true" className="text-lg text-white/50 lg:text-2xl">+</span>
            <p className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-white/55 lg:text-xs">{t.wrote}</span>
              <span className="font-display text-base leading-snug sm:text-lg lg:text-[1.7rem] lg:leading-tight">«{tab.prompt}»</span>
            </p>
          </div>
        </div>
      </div>

      {/* talking formats */}
      <div ref={row.ref} className="flex flex-col gap-6">
        <div className="flex max-w-3xl flex-col gap-2">
          <h3 className="text-2xl font-extrabold sm:text-3xl">{t.voices.title}</h3>
          <p className="text-muted">{t.voices.lead}</p>
        </div>
        <ul className="grid max-w-5xl grid-cols-2 gap-3 lg:grid-cols-4">
          {t.voices.items.filter((x) => media.voices[x.k]).map((x) => {
            const on = sound === x.k;
            return (
              <li key={x.k} className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-surface-2">
                {row.seen && <Clip src={media.voices[x.k]} label={x.title} muted={!on} />}
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <button type="button" onClick={() => setSound(on ? null : x.k)} aria-pressed={on} aria-label={`${on ? t.voices.off : t.voices.on}: ${x.title}`}
                  className={`absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-full backdrop-blur-sm transition-colors ${on ? "bg-[image:var(--grad)] text-white" : "bg-black/60 text-white/90 hover:bg-black/80"}`}>
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 9v6h4l5 4V5L8 9H4Z" />
                    {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
                  </svg>
                </button>
                <span className="absolute inset-x-3 bottom-3 flex flex-col text-white">
                  <b className="leading-tight">{x.title}</b>
                  <span className="text-xs text-white/75">{x.sub}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="-mt-8 text-xs text-muted">{t.note}</p>
    </div>
  );
}
