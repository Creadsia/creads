"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Counts this visit once per browser tab (anonymous, aggregated: see /api/visita). The channel the person
// first came from (instagram, google…) is remembered in a first-party cookie only if they accepted
// cookies in the banner; until then it waits in this tab (sessionStorage) and is saved on «Aceptar»
// (see saveSource, called from meta-pixel.tsx). It lets a later purchase say which channel brought it.

const PENDING = "creads-src";
const hasConsent = () => /(^|;\s*)creads_consent=1/.test(document.cookie);

/** Saves the remembered channel as a cookie, if the person accepted cookies and none is saved yet. */
export function saveSource() {
  try {
    // the ad campaign that brought them (utm_campaign), kept the same way: first touch, only with consent
    const camp = sessionStorage.getItem("creads-camp");
    if (camp && hasConsent() && !/(^|;\s*)creads_camp=/.test(document.cookie)) {
      document.cookie = `creads_camp=${encodeURIComponent(camp)}; Max-Age=${90 * 86400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    }
    const src = sessionStorage.getItem(PENDING);
    if (!src || !hasConsent() || /(^|;\s*)creads_src=/.test(document.cookie)) return;
    document.cookie = `creads_src=${encodeURIComponent(src)}; Max-Age=${90 * 86400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch {}
}

/** A random id for this browser tab (anonymous: only to count each open tab once in «Mirando ahora»). */
function tabId() {
  try {
    let id = sessionStorage.getItem("creads-tab");
    if (!id) { id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36); sessionStorage.setItem("creads-tab", id); }
    return id;
  } catch { return ""; }
}

export default function VisitBeacon() {
  const path = usePathname() ?? "/";
  // «Mirando ahora» in the Panel: a beat every 20 s while the tab is visible (never from the Panel itself)
  useEffect(() => {
    if (/^\/(admin|api)(\/|$)/.test(path)) return;
    const id = tabId();
    if (!id) return;
    const send = () => {
      if (document.visibilityState !== "visible") return;
      try { if (sessionStorage.getItem("creads-interno")) return; } catch {}
      fetch("/api/presencia", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, path: location.pathname }), keepalive: true }).catch(() => {});
    };
    send();
    const t = setInterval(send, 20_000);
    document.addEventListener("visibilitychange", send);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", send); };
  }, [path]);

  // a click on an affiliate's link («?ref=CODE»): counted once per tab and code (the cookie is set by the middleware)
  useEffect(() => {
    try {
      const code = (new URLSearchParams(window.location.search).get("ref") || "").trim().toUpperCase();
      if (!/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(code) || sessionStorage.getItem(`creads-ref-${code}`)) return;
      sessionStorage.setItem(`creads-ref-${code}`, "1");
      fetch("/api/afiliados/clic", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code }), keepalive: true }).catch(() => {});
    } catch {}
  }, []);

  useEffect(() => {
    try {
      const path = window.location.pathname;
      if (/^\/(admin|api)(\/|$)/.test(path)) return;
      if (sessionStorage.getItem("creads-visita")) return;
      sessionStorage.setItem("creads-visita", "1");
      const q = new URLSearchParams(window.location.search);
      const camp = (q.get("utm_campaign") || "").trim().slice(0, 80);
      if (camp) { sessionStorage.setItem("creads-camp", camp); saveSource(); }
      const body = JSON.stringify({ path, ref: document.referrer || "", utm: q.get("utm_source") || "", medium: q.get("utm_medium") || "", fbclid: q.has("fbclid"), gclid: q.has("gclid") });
      fetch("/api/visita", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true })
        .then((r) => (r.ok && r.status !== 204 ? r.json() : null))
        .then((d) => {
          if (typeof d?.src !== "string" || !/^[a-z0-9._-]{2,40}$/.test(d.src)) return;
          sessionStorage.setItem(PENDING, d.src);
          saveSource();
        })
        .catch(() => {});
    } catch {}
  }, []);
  return null;
}
