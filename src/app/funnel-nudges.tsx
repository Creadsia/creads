"use client";

import { useEffect, useRef, useState } from "react";
import { LAUNCH_PCT, LAUNCH_PRICE, PLANS, usd } from "@/lib/catalog";
import { newEventId, track } from "@/lib/track";
import type { Content } from "@/content/en";
import { startHref } from "./pricing";

// Two gentle nudges so a visitor from an ad doesn't leave empty-handed:
// - on phones, a bar at the bottom with the launch offer once they scroll past the top of the page;
// - when they're about to leave (mouse heading to close the tab, or a long visit on a phone without
//   choosing a plan), one offer to save the launch price with their email. Shown once every 3 days.

const SEEN = "creads_exit_seen";
const seenRecently = () => {
  try { return Date.now() - Number(localStorage.getItem(SEEN) || 0) < 3 * 86400_000; } catch { return false; }
};
const markSeen = () => { try { localStorage.setItem(SEEN, String(Date.now())); } catch { /* private mode */ } };

export default function FunnelNudges({ t, lang }: { t: Content["nudge"]; lang: string; rate?: number }) {
  const es = lang === "es";
  const plus = PLANS.find((p) => p.id === "starter")!; // the plan with the launch offer
  const first = LAUNCH_PRICE;
  const price = es ? usd(first) : `US$${first.toFixed(2).replace(/\.00$/, "")}`;

  const [bar, setBar] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"" | "sending" | "done" | "error">("");
  const dialog = useRef<HTMLDialogElement>(null);
  const leaving = useRef(false); // true once they clicked through to checkout

  // bottom bar: after the hero, hidden while the plans themselves are on screen
  useEffect(() => {
    let plansVisible = false;
    const pricing = document.getElementById("pricing");
    const io = pricing && typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((es) => { plansVisible = es.some((e) => e.isIntersecting); onScroll(); }, { threshold: 0.05 })
      : null;
    function onScroll() { setBar(window.scrollY > 650 && !plansVisible); }
    if (pricing) io?.observe(pricing);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); io?.disconnect(); };
  }, []);

  // exit intent
  useEffect(() => {
    const onClick = (e: MouseEvent) => { if ((e.target as Element | null)?.closest?.('a[href^="/empezar"]')) leaving.current = true; };
    document.addEventListener("click", onClick, true);
    const show = () => {
      if (leaving.current || seenRecently()) return;
      markSeen();
      setOpen(true);
    };
    const onOut = (e: MouseEvent) => { if (!e.relatedTarget && e.clientY <= 0) show(); };
    document.addEventListener("mouseout", onOut);
    // phones have no mouse: after 45 s, once they've seen the plans and scrolled back up toward the top
    let sawPlans = false;
    let maxY = 0;
    const touch = window.matchMedia("(hover: none)").matches;
    const started = Date.now();
    const onScroll = () => {
      const y = window.scrollY;
      maxY = Math.max(maxY, y);
      const pricing = document.getElementById("pricing");
      if (pricing && y + window.innerHeight > pricing.offsetTop + 200) sawPlans = true;
      if (touch && sawPlans && Date.now() - started > 45_000 && maxY - y > 1200) show();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mouseout", onOut);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const eventId = newEventId();
    const r = await fetch("/api/waitlist", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, plan: "oferta-salida", lang, eventId }) }).catch(() => null);
    if (!r?.ok) return setState("error");
    track("Lead", { content_name: "Oferta de salida" }, eventId);
    setState("done");
  }

  return (
    <>
      {/* phones: the offer stays one tap away */}
      <div aria-hidden={!bar} className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 px-4 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 lg:hidden ${bar ? "translate-y-0" : "translate-y-full"}`}>
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <span className="min-w-0 text-sm leading-tight">
            <b className="block truncate">{t.bar}</b>
            <span className="text-muted"><s>{es ? usd(plus.monthly) : `US$${plus.monthly}`}</s> {price}</span>
          </span>
          <a href={startHref("plus")} tabIndex={bar ? 0 : -1} className="shrink-0 rounded-xl bg-[image:var(--grad)] px-5 py-3 text-sm font-bold text-white">{t.barCta}</a>
        </div>
      </div>

      {/* about to leave */}
      <dialog ref={dialog} onClose={() => setOpen(false)} aria-labelledby="exit-title"
        className="m-auto w-[min(92vw,460px)] rounded-3xl border border-line bg-surface p-0 text-ink backdrop:bg-black/70 backdrop:backdrop-blur-sm">
        <div className="relative flex flex-col gap-4 overflow-hidden p-6 sm:p-7">
          <span aria-hidden="true" className="pointer-events-none absolute -top-20 -right-16 h-56 w-56 rounded-full opacity-40 blur-[70px]" style={{ background: "var(--grad)" }} />
          <button type="button" onClick={() => setOpen(false)} aria-label={t.exitClose} className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full text-xl text-muted hover:bg-surface-2 hover:text-ink">×</button>
          <span className="chroma relative font-display text-5xl leading-none font-semibold">−{LAUNCH_PCT}%</span>
          <h2 id="exit-title" className="relative pr-8 text-2xl font-extrabold leading-tight">{t.exitTitle}</h2>
          <p className="relative text-muted">{t.exitLead}</p>
          {state === "done" ? (
            <p role="status" className="relative rounded-xl bg-good/15 px-4 py-3 font-semibold text-good">{t.exitDone}</p>
          ) : (
            <form onSubmit={save} className="relative flex flex-col gap-2 sm:flex-row">
              <label htmlFor="exit-email" className="sr-only">Email</label>
              <input id="exit-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={es ? "tu@correo.com" : "you@email.com"} autoComplete="email"
                className="min-w-0 flex-1 rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[16px] outline-none focus:border-accent-text" />
              <button type="submit" disabled={state === "sending"} className="rounded-xl bg-ink px-4 py-3 font-semibold text-bg disabled:opacity-60">{t.exitCta}</button>
            </form>
          )}
          {state === "error" && <p role="alert" className="relative text-sm text-bad">{es ? "No se pudo guardar. Intenta de nuevo." : "Couldn't save. Try again."}</p>}
          <a href="#pricing" onClick={() => setOpen(false)} className="relative rounded-xl bg-[image:var(--grad)] px-5 py-3 text-center font-semibold text-white">{t.exitPlans}</a>
          <button type="button" onClick={() => setOpen(false)} className="relative text-sm text-muted underline">{t.exitClose}</button>
        </div>
      </dialog>
    </>
  );
}
