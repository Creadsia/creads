"use client";

import { useEffect, useRef, useState } from "react";

// A real Creads ad on a phone, playing silently while it's on screen (owner, 22 Oct 2026: no sound on the
// home page). The still shows first, so the page looks complete before any video loads.

export default function DemoPhone({ src, poster, label, className = "", big = false }: { src: string; poster: string; label: string; className?: string; big?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setLoad(true); el.play().catch(() => {}); } else el.pause();
    }, { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure className={`relative ${className}`}>
      <div className={`relative aspect-[9/16] overflow-hidden bg-black ${big ? "rounded-[1.9rem] border-[5px]" : "rounded-[1.4rem] border-4"} border-[#1d1d22] shadow-[0_30px_70px_-25px_rgba(0,0,0,0.8)]`}>
        <video ref={ref} poster={poster} src={load ? src : undefined} muted loop playsInline autoPlay preload="none" aria-label={`Anuncio de ejemplo: ${label}`} className="absolute inset-0 h-full w-full object-cover" />
      </div>
      <figcaption className="mt-2 text-center text-xs font-semibold text-muted">{label}</figcaption>
    </figure>
  );
}
