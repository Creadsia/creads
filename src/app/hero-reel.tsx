"use client";

import { useEffect, useRef } from "react";

// Pro, HeyGen-style hero strip for mobile (owner, 3 Nov 2026: «algo más pro, no tan grotesco»). Clean video
// cards — no phone bezel, no baked label — drifting sideways in a seamless marquee. Two rows run in opposite
// directions around the headline. Videos play muted and loop; the row pauses with reduced motion (globals.css).

export type Clip = { src: string; poster: string };

function Tile({ src, poster }: Clip) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.play().catch(() => {});
  }, []);
  return (
    <div className="w-[7.5rem] shrink-0 overflow-hidden rounded-[1.15rem] bg-surface-2 shadow-[0_14px_34px_-16px_rgba(0,0,0,0.85)] ring-1 ring-white/10 sm:w-36">
      <video ref={ref} src={src} poster={poster} muted loop playsInline autoPlay preload="metadata" aria-hidden="true" className="aspect-[9/16] h-full w-full object-cover" />
    </div>
  );
}

/** Full-width tile for the vertical hero wall (Arcads/HeyGen look): a clean talking-UGC card. */
function WallTile({ src, poster }: Clip) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.play().catch(() => {}); else el.pause(); }, { rootMargin: "200px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className="overflow-hidden rounded-2xl bg-surface-2 shadow-[0_18px_44px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
      <video ref={ref} src={src} poster={poster} muted loop playsInline autoPlay preload="metadata" aria-hidden="true" className="aspect-[9/16] w-full object-cover" />
    </div>
  );
}

/** One vertical column of UGC videos, drifting up or down in a seamless loop (rendered twice). */
export function HeroWallCol({ clips, dir = "up", speed = "64s" }: { clips: Clip[]; dir?: "up" | "down"; speed?: string }) {
  const col = (copy: boolean) => (
    <div className="flex flex-col gap-3 pb-3" aria-hidden={copy || undefined}>
      {clips.map((c) => <WallTile key={`${c.src}${copy ? "-c" : ""}`} {...c} />)}
    </div>
  );
  return (
    <div className={`flex flex-col gap-3 ${dir === "up" ? "marquee-up" : "marquee-down"}`} style={{ ["--speed" as string]: speed }} role="presentation" aria-hidden="true">
      {col(false)}{col(true)}
    </div>
  );
}

/** One drifting row (rendered twice for a seamless loop). `rev` runs it the other way. */
export function HeroReelRow({ clips, rev = false, dur = "52s" }: { clips: Clip[]; rev?: boolean; dur?: string }) {
  const fila = (copy: boolean) => (
    <div className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={copy || undefined}>
      {clips.map((c) => <Tile key={`${c.src}${copy ? "-c" : ""}`} {...c} />)}
    </div>
  );
  return (
    <div className={`marquee ${rev ? "marquee-rev" : ""}`} style={{ ["--dur" as string]: dur }} role="presentation" aria-hidden="true">
      <div className="marquee-track">{fila(false)}{fila(true)}</div>
    </div>
  );
}
