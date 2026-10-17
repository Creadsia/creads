"use client";

import { useEffect, useRef, useState } from "react";

// A silent looping clip that only downloads and plays while it's on screen.
// The still image (poster) shows first, so the page looks complete before any video loads.
// Videos wait until the page has finished loading (text, buttons and prices come first), and are
// skipped entirely on slow connections or data saver: the stills keep the page light.

type Conn = { saveData?: boolean; effectiveType?: string };
let ready: Promise<boolean> | null = null;
function pageReady(): Promise<boolean> {
  if (ready) return ready;
  ready = new Promise((resolve) => {
    const c = (navigator as Navigator & { connection?: Conn }).connection;
    if (c?.saveData || /(^|-)2g|3g/.test(c?.effectiveType ?? "")) return resolve(false);
    const go = () => setTimeout(() => resolve(true), 900);
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
  });
  return ready;
}

export default function LoopVideo({ src, poster, className }: { src: string; poster?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let io: IntersectionObserver | null = null;
    let alive = true;
    pageReady().then((ok) => {
      if (!ok || !alive) return;
      io = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setLoad(true);
            el.play().catch(() => {});
          } else {
            el.pause();
          }
        },
        { rootMargin: "100px" },
      );
      io.observe(el);
    });
    return () => { alive = false; io?.disconnect(); };
  }, []);

  return (
    <video
      ref={ref}
      className={className}
      poster={poster}
      src={load ? src : undefined}
      muted
      loop
      playsInline
      autoPlay
      preload="none"
      aria-hidden="true"
    />
  );
}
