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
