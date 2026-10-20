"use client";

import { useEffect, useState } from "react";
import type { Content } from "@/content/en";
import LoopVideo from "./loop-video";

// The cinema banner: one featured model at a time. Its real clips stand side by side like a cover-flow
// (each at its own 9:16 size, so they stay sharp), and its name sits over them huge, extruded and lit
// with the brand gradient. Rotates by itself; the dots pick one.

export interface SpotMedia { clips: { video: string; still?: string }[]; href: string }

const posterOf = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=640&q=75`;
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
  const mid = (m.clips.length - 1) / 2;

  return (
    <div
      className="stage relative overflow-hidden rounded-[2rem] border border-line"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label={t.label}
    >
      {/* light behind the clips */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/3 h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-35 blur-[110px]" style={{ background: "var(--grad)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.6)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,#000_30%,transparent_75%)]" />

      <div className="relative flex aspect-[4/5] flex-col sm:aspect-[16/9] lg:aspect-[21/9]">
        <span className="absolute right-4 top-4 z-20 rounded-lg border border-white/25 bg-black/40 px-2.5 py-1 font-display text-sm font-semibold text-white backdrop-blur-md sm:right-6 sm:top-6 sm:text-base">{s.badge}</span>
        <span className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-md sm:left-6 sm:top-6">
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[image:var(--grad)]" />{t.inCreads}
        </span>

        {/* cover-flow of the model's own clips */}
        <div key={`flow-${s.id}`} className="spot-in flex flex-1 items-center justify-center gap-2 px-4 pt-14 pb-2 [perspective:1400px] sm:gap-4 sm:pt-8">
          {m.clips.map((c, k) => {
            const off = k - mid;
            return (
              <figure
                key={c.video}
                className="relative aspect-[9/16] h-[58%] shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-[#111216] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] sm:h-[78%] sm:rounded-[1.4rem]"
                style={{
                  transform: `rotateY(${off * -16}deg) translateZ(${off === 0 ? 40 : -30}px) translateY(${Math.abs(off) * 14}px)`,
                  opacity: off === 0 ? 1 : 0.78,
                  zIndex: 10 - Math.abs(off),
                }}
              >
                <LoopVideo src={c.video} poster={c.still ? posterOf(c.still) : undefined} className="absolute inset-0 h-full w-full object-cover" />
                <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              </figure>
            );
          })}
        </div>

        {/* the name over the clips, then the button */}
        <div key={`name-${s.id}`} className="spot-in relative z-20 -mt-[11%] flex flex-col items-center gap-3 px-4 pb-5 text-center sm:-mt-[9%] sm:pb-7">
          <h3 className="spot-name relative font-display text-[clamp(2.4rem,7.5vw,6.5rem)] leading-[0.85] font-bold tracking-[-0.05em] uppercase" aria-label={`${s.name} ${s.ver}`}>
            <span aria-hidden="true" className="spot-extrude">{s.name} {s.ver}</span>
            <span aria-hidden="true" className="spot-face">{s.name} {s.ver}</span>
          </h3>
          <span className="rounded-full border border-white/30 bg-black/50 px-4 py-1.5 font-display text-[11px] font-semibold tracking-wide text-white uppercase backdrop-blur-md sm:text-sm">{s.pill}</span>
          <a href={m.href} className="mt-1 rounded-2xl bg-white px-7 py-3 text-[17px] font-bold text-black shadow-[0_16px_50px_-12px_rgba(255,43,214,0.8)] transition-transform hover:-translate-y-0.5">{t.cta}</a>
          <div className="flex items-center gap-2 pt-1" role="group" aria-label={t.label}>
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
