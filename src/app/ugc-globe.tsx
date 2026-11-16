"use client";

import { useEffect, useRef } from "react";

// The hero visual: a 3D globe of UGC faces wired together like a neural net (owner, 16 Nov 2026).
// Replaces the single big phone. Decorative (aria-hidden); the headline carries the meaning.
// Auto-rotates, drag to spin (desktop), gentle mouse parallax, depth blur, pauses off-screen and on reduced-motion.

const UGC = [
  "ugc-skincare", "ugc-fitness", "ugc-cafeteria", "ugc-automotora", "ugc-gym", "ugc-peluqueria",
  "ugc-mediabuyer", "ugc-tienda", "ugc-proteina", "ugc-depto", "ugc-vsl-colageno",
  "cafeteria", "gym", "dentista", "bano", "creads",
].map((n) => `/demos/${n}.jpg`);
const N = 34;

export default function UgcGlobe() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tileRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const pts: [number, number, number][] = [];
    const off = 2 / N;
    const inc = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = i * off - 1 + off / 2;
      const r = Math.sqrt(1 - y * y);
      const phi = i * inc;
      pts.push([Math.cos(phi) * r, y, Math.sin(phi) * r]);
    }
    const pairs: [number, number][] = [];
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], dz = pts[i][2] - pts[j][2];
        if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 0.64) pairs.push([i, j]);
      }
    }
    const tiles = tileRefs.current;
    const St = pts.map(() => ({ X: 0, Y: 0, D: 0 }));
    let ry = 0, rx = -0.18, vy = 0.0015, vx = 0, dragging = false, lx = 0, ly = 0;
    let R = 0, S = 0, mx = 0, my = 0, tiltX = 0, tiltY = 0, hot = -1, raf = 0, visible = true;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) vy = 0;

    const size = () => {
      S = wrap.clientWidth;
      R = S * 0.44;
      cv.width = S * dpr; cv.height = S * dpr;
      cv.style.width = S + "px"; cv.style.height = S + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const ro = new ResizeObserver(size); ro.observe(wrap);

    const loop = () => {
      if (!visible) { raf = 0; return; }
      if (!dragging) { ry += vy; rx += vx; vx *= 0.94; }
      tiltX += (my * 0.22 - tiltX) * 0.06;
      tiltY += (mx * 0.22 - tiltY) * 0.06;
      const ax = rx + tiltX, ay = ry + tiltY;
      const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax), c = S / 2;
      for (let k = 0; k < N; k++) {
        const el = tiles[k];
        const [x, y, z] = pts[k];
        const x1 = x * cy - z * sy, z1 = x * sy + z * cy;
        const y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
        const depth = (z2 + 1) / 2;
        St[k].X = x1 * R; St[k].Y = y2 * R; St[k].D = depth;
        if (!el) continue;
        const isHot = k === hot;
        const sc = (0.5 + depth * 0.62) * (isHot ? 1.4 : 1);
        el.style.transform = `translate3d(${St[k].X.toFixed(1)}px,${St[k].Y.toFixed(1)}px,0) scale(${sc.toFixed(3)})`;
        el.style.opacity = (0.3 + depth * 0.7).toFixed(3);
        el.style.zIndex = String(isHot ? 200 : Math.round(depth * 100));
        const blur = depth < 0.5 ? ((0.5 - depth) * 3.4).toFixed(1) : "0";
        el.style.filter = `blur(${blur}px) saturate(${(0.8 + depth * 0.25).toFixed(2)})`;
      }
      ctx.clearRect(0, 0, S, S);
      for (const [i, j] of pairs) {
        const a = St[i], b = St[j], dd = (a.D + b.D) / 2;
        if (dd < 0.3) continue;
        ctx.beginPath();
        ctx.moveTo(c + a.X, c + a.Y);
        ctx.lineTo(c + b.X, c + b.Y);
        ctx.strokeStyle = `rgba(232,89,31,${(0.04 + dd * 0.18).toFixed(3)})`;
        ctx.lineWidth = 0.7 + dd * 0.7;
        ctx.stroke();
      }
      raf = requestAnimationFrame(loop);
    };

    const io = new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      if (visible && !raf) loop();
    }, { rootMargin: "120px" });
    io.observe(wrap);
    loop();

    const onDown = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; };
    const onUp = () => { dragging = false; if (Math.abs(vy) < 0.0004 && !reduce) vy = 0.0015; };
    const onMove = (e: PointerEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 2;
      my = (e.clientY / window.innerHeight - 0.5) * 2;
      if (dragging) {
        const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
        ry += dx * 0.006; rx += dy * 0.006; vy = dx * 0.0006; vx = dy * 0.0006;
      }
    };
    wrap.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);

    const hoverFns = tiles.map((el, k) => {
      const fn = () => { hot = k; };
      const fo = () => { if (hot === k) hot = -1; };
      if (el) { el.addEventListener("mouseenter", fn); el.addEventListener("mouseleave", fo); }
      return { el, fn, fo };
    });

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      wrap.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      hoverFns.forEach(({ el, fn, fo }) => {
        if (el) { el.removeEventListener("mouseenter", fn); el.removeEventListener("mouseleave", fo); }
      });
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="relative mx-auto aspect-square w-full max-w-[460px] cursor-grab select-none active:cursor-grabbing"
      style={{ touchAction: "pan-y" }}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
        {Array.from({ length: N }).map((_, k) => (
          <div
            key={k}
            ref={(el) => { tileRefs.current[k] = el; }}
            className="absolute left-1/2 top-1/2 -ml-[29px] -mt-[42px] h-[84px] w-[58px] overflow-hidden rounded-xl border-[1.5px] border-white/90 bg-[#e6e2dc] shadow-[0_10px_24px_-12px_rgba(20,18,16,0.45)] will-change-transform"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static local poster */}
            <img src={UGC[k % UGC.length]} alt="" className="h-full w-full object-cover" draggable={false} />
          </div>
        ))}
      </div>
    </div>
  );
}
