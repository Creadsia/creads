"use client";

import { useEffect, useState } from "react";
import type { Content } from "@/content/en";
import LoopVideo from "./loop-video";

// The cinema banner: one featured model at a time, its clip full width and its name huge, extruded
// and lit with the brand gradient. Rotates by itself; the dots (and arrows on desktop) pick one.

export interface SpotMedia { video: string; still?: string; href: string }

const posterOf = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=1200&q=70`;
const EVERY = 7000;

export default function Spotlight({ t, media }: { t: Content["spotlight"]; media: Record<string, SpotMedia> }) {
  const items = t.items.filter((x) => media[x.id]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setTimeout(() => setI((x) => (x + 1) % items.length), EVERY);
    return () => clearTimeout(id);
  }, [i, paused, items.length]);
  if (!items.length) return null;
  const s = items[i];
  const m = media[s.id];

  return (
    <div
      className="stage relative overflow-hidden rounded-[2rem] border border-line"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label={t.label}
    >
      <div className="relative aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]">
        {items.map((x, k) => (
          <div key={x.id} aria-hidden={k !== i} className={`absolute inset-0 transition-opacity duration-700 ${k === i ? "opacity-100" : "opacity-0"}`}>
            <LoopVideo src={media[x.id].video} poster={media[x.id].still ? posterOf(media[x.id].still!) : undefined} className="absolute inset-0 h-full w-full object-cover" />
          </div>
        ))}
        <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.15)_0%,rgba(0,0,0,0.55)_70%,rgba(0,0,0,0.85)_100%)]" />

        <span className="absolute right-4 top-4 rounded-lg border border-white/25 bg-black/40 px-2.5 py-1 font-display text-sm font-semibold text-white backdrop-blur-md sm:right-6 sm:top-6 sm:text-base">{s.badge}</span>
        <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md sm:left-6 sm:top-6">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[image:var(--grad)]" />{t.inCreads}
        </span>

        <div key={s.id} className="spot-in absolute inset-0 flex flex-col items-center justify-center gap-4 px-4 pb-24 text-center sm:pb-28">
          <h3 className="spot-name relative font-display text-[clamp(2.6rem,8vw,7rem)] leading-[0.85] font-bold tracking-[-0.05em] uppercase" aria-label={`${s.name} ${s.ver}`}>
            <span aria-hidden="true" className="spot-extrude">{s.name} {s.ver}</span>
            <span aria-hidden="true" className="spot-face">{s.name} {s.ver}</span>
          </h3>
          <span className="rounded-full border border-white/30 bg-black/35 px-4 py-1.5 font-display text-xs font-semibold tracking-wide text-white uppercase backdrop-blur-md sm:text-sm">{s.pill}</span>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 p-5 sm:p-7">
          <a href={m.href} className="rounded-2xl bg-white px-7 py-3.5 text-[17px] font-bold text-black shadow-[0_16px_50px_-12px_rgba(255,43,214,0.8)] transition-transform hover:-translate-y-0.5">{t.cta}</a>
          <div className="flex items-center gap-2" role="group" aria-label={t.label}>
            {items.map((x, k) => (
              <button key={x.id} type="button" onClick={() => setI(k)} aria-label={`${x.name} ${x.ver}`} aria-current={k === i}
                className={`h-1.5 rounded-full transition-all ${k === i ? "w-8 bg-white" : "w-3 bg-white/40 hover:bg-white/70"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
