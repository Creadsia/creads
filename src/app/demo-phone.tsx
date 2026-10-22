"use client";

import { useEffect, useRef, useState } from "react";

// A real Creads ad on a phone: plays silently while on screen; one tap turns the sound on (and mutes any
// other phone), so a visitor can hear the Chilean voice and the lips for themselves.

const EVENT = "creads-demo-sound";

export default function DemoPhone({ src, poster, label, className = "", big = false }: { src: string; poster: string; label: string; className?: string; big?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setLoad(true); if (!reduce || !el.muted) el.play().catch(() => {}); }
      else el.pause();
    }, { rootMargin: "120px" });
    io.observe(el);
    const other = (ev: Event) => { if ((ev as CustomEvent).detail !== src) { el.muted = true; setSound(false); } };
    window.addEventListener(EVENT, other);
    return () => { io.disconnect(); window.removeEventListener(EVENT, other); };
  }, [src]);

  function toggle() {
    const el = ref.current;
    if (!el) return;
    setLoad(true);
    if (el.muted) {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: src }));
      el.muted = false;
      el.currentTime = 0;
      el.play().catch(() => {});
      setSound(true);
    } else {
      el.muted = true;
      setSound(false);
    }
  }

  return (
    <figure className={`relative ${className}`}>
      <div className={`relative aspect-[9/16] overflow-hidden bg-black ${big ? "rounded-[1.9rem] border-[5px]" : "rounded-[1.4rem] border-4"} border-[#1d1d22] shadow-[0_30px_70px_-25px_rgba(0,0,0,0.8)]`}>
        <video ref={ref} poster={poster} src={load ? src : undefined} muted loop playsInline autoPlay preload="none" className="absolute inset-0 h-full w-full object-cover" aria-label={`Anuncio de ejemplo: ${label}`} />
        <button type="button" onClick={toggle} className="absolute inset-0 flex items-start justify-end p-2.5" aria-pressed={sound} aria-label={sound ? "Silenciar" : `Escuchar el anuncio de ${label}`}>
          <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur ${sound ? "bg-white text-black" : "bg-black/55 text-white"}`}>
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true"><path d="M3 8h3l4-3v10l-4-3H3z" fill="currentColor" />{sound ? <path d="M13 7.5a3.5 3.5 0 010 5M15 5.5a6.5 6.5 0 010 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /> : <path d="M13 8l4 4M17 8l-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}</svg>
            {sound ? "Sonando" : "Escuchar"}
          </span>
        </button>
      </div>
      <figcaption className="mt-2 text-center text-xs font-semibold text-muted">{label}</figcaption>
    </figure>
  );
}
