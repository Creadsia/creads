"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { saveSource } from "./visit-beacon";

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
  // the pixel ID is set in Panel → Marketing → Conexiones; events wait in the queue until it's known,
  // and «init» goes first so Meta reads them in order
  const start = (id: string) => {
    n.queue!.unshift(["init", id]);
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(s);
  };
  fetch("/api/meta/pixel").then((r) => r.json()).then((d: { id?: string }) => start(/^\d{8,20}$/.test(d.id ?? "") ? d.id! : PIXEL_ID)).catch(() => start(PIXEL_ID));
}

// RedTrack's universal script (campaign tracking), also only with consent. Its click id comes back to our
// server in a cookie; a ?rtkcid= in the link is kept too, in case the script is blocked.
const RTK_SRC = process.env.NEXT_PUBLIC_REDTRACK_SCRIPT || "";
function loadRedtrack() {
  try {
    const id = new URLSearchParams(location.search).get("rtkcid");
    if (id && /^[A-Za-z0-9_-]{10,64}$/.test(id)) document.cookie = `creads_rtk=${id}; Max-Age=${90 * 86400}; Path=/; SameSite=Lax; Secure`;
  } catch {}
  if (!/^https:\/\/[\w.-]+\//.test(RTK_SRC) || document.querySelector("script[data-rtk]")) return;
  const s = document.createElement("script");
  s.async = true; s.src = RTK_SRC; s.dataset.rtk = "1";
  document.body.appendChild(s);
}

const readChoice = () => {
  try { const m = document.cookie.match(/(?:^|;\s*)creads_consent=([01])/); return m ? m[1] : null; } catch { return null; }
};
const saveChoice = (v: "0" | "1") => {
  document.cookie = `creads_consent=${v}; Max-Age=${365 * 86400}; Path=/; SameSite=Lax; Secure`;
  if (v === "1") { saveSource(); window.dispatchEvent(new Event("creads-consent")); }
};

export default function MetaPixel() {
  const path = usePathname() ?? "/";
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const [notice, setNotice] = useState(false);
  // Measurement is on unless the person turns it off (owner, 23 Oct 2026: the «Aceptar» banner hid most ad
  // visits from Meta). The first visit gets a small notice with «Desactivar»; that choice is kept for a year.
  useEffect(() => {
    const c = readChoice();
    if (c === null) { saveChoice("1"); setChoice("1"); setNotice(true); } else setChoice(c);
  }, []);

  // a page view on load and on every page change (the studio changes pages without reloading)
  useEffect(() => {
    if (choice !== "1") return;
    if (path.startsWith("/clave")) return; // the password-reset link carries a secret: never sent to Meta
    loadPixel();
    loadRedtrack();
    const w = window as unknown as { fbq: Fbq; __creadsQ?: unknown[][] };
    w.fbq("track", "PageView");
    // events a page fired before the pixel was ready (e.g. the checkout's ViewContent)
    for (const args of w.__creadsQ?.splice(0) ?? []) w.fbq(...args);
  }, [choice, path]);

  if (!notice) return null;
  const es = !path.startsWith("/en");
  return (
    <div role="status" aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-line bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="min-w-0 flex-1 text-muted">
        {es
          ? <>Usamos cookies para medir qué anuncios funcionan y mejorar el sitio. <a href="/privacidad" className="underline">Privacidad</a></>
          : <>We use cookies to measure which ads work and improve the site. <a href="/privacidad" className="underline">Privacy</a></>}
      </p>
      <button type="button" onClick={() => { saveChoice("0"); location.reload(); }} className="shrink-0 text-muted underline hover:text-ink">{es ? "Desactivar" : "Turn off"}</button>
      <button type="button" onClick={() => setNotice(false)} className="shrink-0 rounded-lg bg-ink px-3 py-1.5 font-semibold text-bg">Ok</button>
    </div>
  );
}
