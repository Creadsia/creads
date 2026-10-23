"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { saveSource } from "./visit-beacon";

// Meta Pixel + RedTrack. Measurement is on from the first visit with no banner (owner, 23 Oct 2026: every
// visit must reach Meta). The only way to turn it off is the switch on /privacidad (cookie creads_consent=0).

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
export const saveChoice = (v: "0" | "1") => {
  document.cookie = `creads_consent=${v}; Max-Age=${365 * 86400}; Path=/; SameSite=Lax; Secure`;
  if (v === "1") { saveSource(); window.dispatchEvent(new Event("creads-consent")); }
};

export default function MetaPixel() {
  const path = usePathname() ?? "/";
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  // on unless the person turned it off on /privacidad
  useEffect(() => {
    const c = readChoice();
    if (c === null) { saveChoice("1"); setChoice("1"); } else setChoice(c);
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

  return null;
}

/** The switch on /privacidad: the only place to turn measurement off (or back on). */
export function MedicionSwitch() {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => { setOn(readChoice() !== "0"); }, []);
  if (on === null) return null;
  return (
    <p className="text-sm">
      Medición en este navegador: <b>{on ? "activa" : "desactivada"}</b>.{" "}
      <button type="button" onClick={() => { saveChoice(on ? "0" : "1"); location.reload(); }} className="underline">{on ? "Desactivarla" : "Activarla"}</button>
    </p>
  );
}
