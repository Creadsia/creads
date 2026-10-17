"use client";

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
    const src = sessionStorage.getItem(PENDING);
    if (!src || !hasConsent() || /(^|;\s*)creads_src=/.test(document.cookie)) return;
    document.cookie = `creads_src=${encodeURIComponent(src)}; Max-Age=${90 * 86400}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch {}
}

export default function VisitBeacon() {
  useEffect(() => {
    try {
      const path = window.location.pathname;
      if (/^\/(admin|api)(\/|$)/.test(path)) return;
      if (sessionStorage.getItem("creads-visita")) return;
      sessionStorage.setItem("creads-visita", "1");
      const q = new URLSearchParams(window.location.search);
      const body = JSON.stringify({ path, ref: document.referrer || "", utm: q.get("utm_source") || "", fbclid: q.has("fbclid"), gclid: q.has("gclid") });
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
