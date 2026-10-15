"use client";

import { useEffect, useRef, useState } from "react";

// A silent looping clip that only downloads and plays while it's on screen.
// The still image (poster) shows first, so the page looks complete before any video loads.
export default function LoopVideo({ src, poster, className }: { src: string; poster: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoad(true);
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
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
