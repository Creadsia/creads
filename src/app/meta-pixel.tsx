"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Meta Pixel + the cookie notice. The pixel loads only after the visitor accepts (Chile's data law,
// Ley 21.719, and GDPR-style rules ask for consent before tracking). The choice is kept for a year.

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "2078637222831496";
type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; push?: unknown; loaded?: boolean; version?: string };

function loadPixel() {
  const w = window as unknown as { fbq?: Fbq; _fbq?: Fbq };
  if (w.fbq) return;
  const n = function (...args: unknown[]) { if (n.callMethod) n.callMethod(...args); else n.queue!.push(args); } as Fbq;
  n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
  w.fbq = n; w._fbq = n;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  n("init", PIXEL_ID);
}

const readChoice = () => {
  try { const m = document.cookie.match(/(?:^|;\s*)creads_consent=([01])/); return m ? m[1] : null; } catch { return null; }
};
const saveChoice = (v: "0" | "1") => {
  document.cookie = `creads_consent=${v}; Max-Age=${365 * 86400}; Path=/; SameSite=Lax; Secure`;
};

export default function MetaPixel() {
  const path = usePathname() ?? "/";
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  useEffect(() => setChoice(readChoice()), []);

  // a page view on load and on every page change (the studio changes pages without reloading)
  useEffect(() => {
    if (choice !== "1") return;
    loadPixel();
    const w = window as unknown as { fbq: Fbq; __creadsQ?: unknown[][] };
    w.fbq("track", "PageView");
    // events a page fired before the pixel was ready (e.g. the checkout's ViewContent)
    for (const args of w.__creadsQ?.splice(0) ?? []) w.fbq(...args);
  }, [choice, path]);

  if (choice !== null) return null;
  const es = !path.startsWith("/en");
  return (
    <div role="dialog" aria-live="polite" aria-label={es ? "Cookies" : "Cookies"}
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface/95 p-4 text-sm shadow-2xl backdrop-blur sm:flex-nowrap">
      <p className="min-w-0 flex-1 text-muted">
        {es
          ? <>Usamos cookies para medir qué anuncios nos traen visitas (Meta). Las de funcionamiento siempre están activas. <a href="/privacidad" className="underline">Privacidad</a></>
          : <>We use cookies to measure which ads bring visitors (Meta). Essential cookies are always on. <a href="/privacidad" className="underline">Privacy</a></>}
      </p>
      <span className="flex shrink-0 gap-2">
        <button type="button" onClick={() => { saveChoice("0"); setChoice("0"); }} className="rounded-lg border border-line px-3 py-2 font-semibold text-muted hover:text-ink">{es ? "Solo necesarias" : "Essential only"}</button>
        <button type="button" onClick={() => { saveChoice("1"); setChoice("1"); }} className="rounded-lg bg-ink px-3 py-2 font-semibold text-bg">{es ? "Aceptar" : "Accept"}</button>
      </span>
    </div>
  );
}
