"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { type Tour, type TourStep, TOURS, VIDEOS, tourMatches, toursFor } from "@/lib/tours";
import { askAssistant } from "./assistant";

// The studio's step-by-step guides (see src/lib/tours.ts) and the "?" help button.
// A guide starts by itself the first time a screen is opened on this browser; the "?" button replays
// it, plays the screen's help video, opens the assistant or the help center.

const SEEN = "creads-guias";
export const TOUR_EVENT = "creads:guia";
export const VIDEO_EVENT = "creads:video";
/** Starts a guide by id (or the one that fits the current screen). */
export const startTour = (id?: string) => window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: id ?? "" }));
/** Opens a help video by id. */
export const playHelpVideo = (id: string) => window.dispatchEvent(new CustomEvent(VIDEO_EVENT, { detail: id }));

type Seen = Record<string, 1> & { off?: 1 };
function readSeen(): Seen {
  try { const v = JSON.parse(localStorage.getItem(SEEN) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
function writeSeen(s: Seen) {
  try { localStorage.setItem(SEEN, JSON.stringify(s)); } catch {}
}

/** The first element with this marker that is actually on screen (not inside a closed menu).
 *  "a|b" tries a, then b (e.g. the side menu on a computer, the menu button on a phone). */
function findTarget(target?: string): HTMLElement | null {
  if (!target) return null;
  for (const t of target.split("|")) {
    for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${t}"]`)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden") return el;
    }
  }
  return null;
}

/** The guide that fits what is on screen now: a guide waiting for an element beats the general one. */
function bestTour(path: string): Tour | null {
  const list = toursFor(path);
  return list.find((t) => t.when && findTarget(t.when)) ?? list.find((t) => !t.when) ?? list[0] ?? null;
}

/** A guide can start when it has nothing to point at, or when something it points at is on screen. */
function canShow(t: Tour) {
  if (t.when && !findTarget(t.when)) return false;
  const targeted = t.steps.filter((s) => s.target);
  return targeted.length === 0 || targeted.some((s) => findTarget(s.target));
}

/**
 * While a guide or video is open, the rest of the page can't be reached with the mouse or the
 * keyboard (`inert`), and focus goes back where it was when it closes.
 */
function useModal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const others = Array.from(document.body.children).filter((el) => el !== root.current && !el.hasAttribute("inert")) as HTMLElement[];
    others.forEach((el) => el.setAttribute("inert", ""));
    return () => {
      others.forEach((el) => el.removeAttribute("inert"));
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, [root]);
}

/** Renders into its own element at the end of <body> (so the rest of the page can be made inert). */
function Layer({ children }: { children: (ref: React.RefObject<HTMLDivElement | null>) => React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    ref.current = el;
    setHost(el);
    return () => { el.remove(); };
  }, []);
  return host ? createPortal(children(ref), host) : null;
}

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function Runner({ tour, onClose, root }: { tour: Tour; onClose: (finished: boolean) => void; root: React.RefObject<HTMLDivElement | null> }) {
  useModal(root);
  // an optional step shows only if its element is on screen when the guide gets to it
  const ok = (s: TourStep) => !s.optional || Boolean(findTarget(s.target));
  const [i, setI] = useState(() => Math.max(0, tour.steps.findIndex(ok)));
  const go = (dir: 1 | -1) => setI((v) => { for (let k = v + dir; k >= 0 && k < tour.steps.length; k += dir) if (ok(tour.steps[k])) return k; return v; });
  const steps = tour.steps.filter((s, k) => k === i || ok(s));
  const pos = steps.indexOf(tour.steps[i]);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [card, setCard] = useState<{ top: number; left: number } | null>(null);
  const [mobile, setMobile] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const step = tour.steps[i];
  const last = pos === steps.length - 1;

  const measure = useCallback(() => {
    const el = findTarget(step?.target);
    const m = window.innerWidth < 640;
    setMobile(m);
    const r = el?.getBoundingClientRect() ?? null;
    setRect(r);
    const box = cardRef.current?.getBoundingClientRect();
    const w = box?.width ?? 340, h = box?.height ?? 180;
    if (m || !r) { setCard(null); return; }
    const gap = 14, vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.min(Math.max(16, r.left), vw - w - 16);
    let top: number;
    if (r.bottom + gap + h <= vh - 16) top = r.bottom + gap;
    else if (r.top - gap - h >= 16) top = r.top - gap - h;
    else top = Math.max(16, vh - h - 16); // tall element: over its lower part
    setCard({ top, left });
  }, [step?.target]);

  // bring the element into view, then follow it while the page settles
  useLayoutEffect(() => {
    const el = findTarget(step?.target);
    if (el) {
      const r = el.getBoundingClientRect();
      const m = window.innerWidth < 640;
      const vh = window.innerHeight;
      // works inside scrolling boxes too (the side menu); on phones the card sits at the bottom, so the
      // element goes to the upper part of the screen
      if (r.top < 64 || r.bottom > (m ? vh * 0.6 : vh - 40)) {
        const behavior = reduced() ? "auto" : "smooth";
        if (m) window.scrollTo({ top: window.scrollY + r.top - 76, behavior }); // below the sticky top bar
        else el.scrollIntoView({ block: r.height > vh * 0.5 ? "start" : "center", behavior });
      }
    }
    measure();
    let n = 0, raf = 0;
    const tick = () => { measure(); if (++n < 40) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [i, step?.target, measure]);

  useEffect(() => {
    const on = () => measure();
    window.addEventListener("resize", on);
    window.addEventListener("scroll", on, true);
    return () => { window.removeEventListener("resize", on); window.removeEventListener("scroll", on, true); };
  }, [measure]);

  useEffect(() => { nextRef.current?.focus({ preventScroll: true }); }, [i]);

  // room to scroll the last elements of a page above the card (it covers the bottom of a phone)
  useEffect(() => {
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "60vh";
    return () => { document.body.style.paddingBottom = prev; };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });

  if (!step) return null;
  const pad = 8;
  const hole = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;
  const anim = reduced() ? "" : "transition-all duration-300 ease-out";

  return (
    <div className="fixed inset-0 z-[70] print:hidden" role="dialog" aria-modal="true" aria-labelledby="guia-t" aria-describedby="guia-d">
      {/* the dim layer catches clicks so the page can't be used by mistake mid-guide */}
      <div className="absolute inset-0" aria-hidden="true" />
      {hole ? (
        <div aria-hidden="true" className={`pointer-events-none absolute rounded-xl ${anim}`}
          style={{ ...hole, boxShadow: "0 0 0 2px var(--accent-text), 0 0 0 9999px rgba(0,0,0,0.74)" }} />
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-black/75" />
      )}
      <div ref={cardRef}
        className={`absolute flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] ${mobile ? "inset-x-3 bottom-3" : "w-[340px]"} ${!mobile && !card ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" : ""} ${anim}`}
        style={!mobile && card ? { top: card.top, left: card.left } : undefined}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-accent-text">{tour.title} · {pos + 1} de {steps.length}</span>
          <button type="button" onClick={() => onClose(false)} className="rounded-md px-1.5 text-xs font-semibold text-muted hover:text-ink">Saltar guía</button>
        </div>
        <div className="flex flex-col gap-1">
          <h2 id="guia-t" className="font-display text-lg leading-snug font-bold">{step.title}</h2>
          <p id="guia-d" className="text-sm leading-relaxed text-muted">{step.text}</p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="flex gap-1" aria-hidden="true">
            {steps.map((_, k) => <i key={k} className={`h-1.5 rounded-full ${k === pos ? "w-4 bg-accent-text" : "w-1.5 bg-line"}`} />)}
          </span>
          <span className="flex gap-2">
            {pos > 0 && <button type="button" onClick={() => go(-1)} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted hover:text-ink">Atrás</button>}
            <button ref={nextRef} type="button" onClick={() => (last ? onClose(true) : go(1))} className="rounded-lg bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink">
              {last ? "Listo" : "Siguiente"}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function VideoModal({ id, onClose, root }: { id: string; onClose: () => void; root: React.RefObject<HTMLDivElement | null> }) {
  useModal(root);
  const v = VIDEOS.find((x) => x.id === id);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  if (!v) return null;
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-3 print:hidden" role="dialog" aria-modal="true" aria-label={v.title}>
      <button type="button" aria-label="Cerrar video" onClick={onClose} className="absolute inset-0 bg-[rgba(10,8,22,0.8)]" />
      <div className="relative flex w-full max-w-4xl flex-col gap-3 rounded-2xl border border-line bg-surface p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <b className="font-display text-lg">{v.title}</b>
            <span className="text-sm text-muted">{v.text}</span>
          </div>
          <button ref={close} type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted hover:text-ink">Cerrar</button>
        </div>
        <video src={`/ayuda/${v.id}.mp4`} poster={`/ayuda/${v.id}.jpg`} controls autoPlay playsInline className="aspect-video w-full rounded-xl bg-black" />
      </div>
    </div>
  );
}

/** Mounted once in the studio frame: runs the guides and the help videos. */
export function Guides() {
  const path = usePathname() ?? "/app";
  const [active, setActive] = useState<Tour | null>(null);
  const [video, setVideo] = useState<string | null>(null);
  const activeRef = useRef<Tour | null>(null);
  activeRef.current = active;

  // "Saltar guía" means no more guides on this screen for now; "Listo" lets the next one (e.g. the
  // next step of «Crear anuncio») show when its time comes
  const finish = useCallback((t: Tour, finished: boolean) => {
    const s = readSeen();
    s[t.id] = 1;
    if (!finished) for (const x of toursFor(path)) s[x.id] = 1;
    writeSeen(s);
    setActive(null);
  }, [path]);
  const closeVideo = useCallback(() => setVideo(null), []);

  // first visit: start the guide that fits the screen once its elements are there
  useEffect(() => {
    if (/[?&]sin-guia\b/.test(window.location.search)) return;
    let timer = 0;
    const check = () => {
      timer = 0;
      if (activeRef.current || document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const seen = readSeen();
      const left = toursFor(path).filter((t) => !seen[t.id]);
      if (seen.off || !left.length) { mo.disconnect(); return; }
      // the guide for the current state of the screen first (as the «Ayuda» button does)
      const next = left.filter((t) => t.when).find(canShow) ?? left.filter((t) => !t.when).find(canShow);
      if (next) setActive(next);
    };
    // throttled, not debounced: a page that keeps changing (a timer ticking) must not delay it forever
    const later = () => { if (!timer) timer = window.setTimeout(check, 900); };
    const mo = new MutationObserver(later);
    later();
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { clearTimeout(timer); mo.disconnect(); };
  }, [path]);

  useEffect(() => { setActive(null); setVideo(null); }, [path]);

  // ?guia=<id> (from the help center): start that guide once its screen is ready
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("guia");
    const t = id ? TOURS.find((x) => x.id === id && tourMatches(x, path)) : null;
    if (!t) return;
    let n = 0;
    const iv = window.setInterval(() => {
      const ready = !t.when || findTarget(t.when);
      if (ready || ++n > 20) {
        window.clearInterval(iv);
        if (ready) setActive(t);
        // so a reload or going back doesn't start it again
        const u = new URL(window.location.href); u.searchParams.delete("guia"); window.history.replaceState(window.history.state, "", u);
      }
    }, 300);
    return () => window.clearInterval(iv);
  }, [path]);

  useEffect(() => {
    const onTour = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      const t = id ? TOURS.find((x) => x.id === id) : bestTour(path);
      if (t) setActive(t);
    };
    const onVideo = (e: Event) => setVideo((e as CustomEvent<string>).detail || null);
    window.addEventListener(TOUR_EVENT, onTour);
    window.addEventListener(VIDEO_EVENT, onVideo);
    return () => { window.removeEventListener(TOUR_EVENT, onTour); window.removeEventListener(VIDEO_EVENT, onVideo); };
  }, [path]);

  return (
    <>
      {active && <Layer key={active.id}>{(root) => <Runner tour={active} root={root} onClose={(done) => finish(active, done)} />}</Layer>}
      {video && <Layer key={video}>{(root) => <VideoModal id={video} root={root} onClose={closeVideo} />}</Layer>}
    </>
  );
}

/** The "?" button at the top of every studio screen. */
export function HelpButton() {
  const path = usePathname() ?? "/app";
  const [open, setOpen] = useState(false);
  const [auto, setAuto] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const tours = toursFor(path);
  const vid = tours.find((t) => t.video)?.video;
  const v = VIDEOS.find((x) => x.id === vid);

  useEffect(() => { setAuto(!readSeen().off); }, [open]);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", away);
    window.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", away); window.removeEventListener("keydown", key); };
  }, [open]);

  const toggleAuto = () => {
    const s = readSeen();
    if (s.off) delete s.off; else s.off = 1;
    writeSeen(s);
    setAuto(!s.off);
  };
  const item = "flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-2";

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((x) => !x)} aria-expanded={open} aria-controls="ayuda-menu" data-tour="ayuda"
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-sm font-semibold text-muted hover:text-ink">
        <span aria-hidden="true" className="grid h-[18px] w-[18px] place-items-center rounded-full border border-current text-[11px] font-bold">?</span>
        <span>Ayuda</span>
      </button>
      {open && (
        <div id="ayuda-menu" className="absolute right-0 z-40 mt-2 flex w-[min(300px,calc(100vw-24px))] flex-col gap-0.5 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          {tours.length > 0 && (
            <button type="button" className={item} onClick={() => { setOpen(false); startTour(); }}>
              <span aria-hidden="true">🧭</span><span className="flex flex-col"><b>Guía paso a paso</b><span className="text-xs text-muted">Te muestra cómo se usa esta pantalla.</span></span>
            </button>
          )}
          {v && (
            <button type="button" className={item} onClick={() => { setOpen(false); playHelpVideo(v.id); }}>
              <span aria-hidden="true">▶️</span><span className="flex flex-col"><b>Ver el video</b><span className="text-xs text-muted">{v.title}{v.secs ? ` · ${Math.round(v.secs)} s` : ""}</span></span>
            </button>
          )}
          <button type="button" className={item} onClick={() => { setOpen(false); askAssistant(); }}>
            <span aria-hidden="true">💬</span><span className="flex flex-col"><b>Preguntarle al asistente</b><span className="text-xs text-muted">Responde al tiro, 24/7.</span></span>
          </button>
          <Link href="/app/ayuda" className={item} onClick={() => setOpen(false)}>
            <span aria-hidden="true">📚</span><span className="flex flex-col"><b>Centro de ayuda</b><span className="text-xs text-muted">Todas las guías y videos.</span></span>
          </Link>
          <label className="mt-1 flex cursor-pointer items-center gap-2 border-t border-line px-3 pt-2.5 pb-1.5 text-xs text-muted">
            <input type="checkbox" checked={auto} onChange={toggleAuto} />
            Mostrar las guías la primera vez que abro una pantalla
          </label>
        </div>
      )}
    </div>
  );
}
