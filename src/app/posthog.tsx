"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import posthog from "posthog-js";

// PostHog: session replays, errors and funnels, to see where people get stuck. Same rule as the Meta
// Pixel: it starts only after the visitor accepts measurement cookies. Everything typed is masked, the
// Panel (/admin) and the password-reset link (/clave, it carries a secret) are never recorded, and events
// go through our own domain (/ingest, see next.config.ts) so no outside script is loaded.

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
const ENV = process.env.NEXT_PUBLIC_VERCEL_ENV || (process.env.NODE_ENV === "production" ? "production" : "development");
const PRIVATE = /^\/(admin|clave)(\/|$)/;

const consented = () => {
  try { return document.cookie.split(/;\s*/).includes("creads_consent=1"); } catch { return false; }
};

let started = false;
function start() {
  if (started || !KEY.startsWith("phc_")) return;
  started = true;
  posthog.init(KEY, {
    api_host: "/ingest",
    ui_host: "https://us.posthog.com",
    capture_pageview: "history_change", // the studio changes pages without reloading
    capture_pageleave: true,
    capture_exceptions: true,
    person_profiles: "identified_only",
    session_recording: { maskAllInputs: true, maskTextSelector: "[data-private]" },
    before_send: (e) => {
      const url = String(e?.properties?.$current_url ?? "");
      try { if (PRIVATE.test(new URL(url).pathname)) return null; } catch { /* no url: keep */ }
      return e;
    },
    loaded: (ph) => ph.register({ entorno: ENV }),
  });
}

export default function PostHog() {
  const path = usePathname() ?? "/";
  useEffect(() => {
    // accepting cookies on this page starts it right away
    const on = () => { start(); if (started && !PRIVATE.test(location.pathname)) posthog.startSessionRecording(); };
    window.addEventListener("creads-consent", on);
    return () => window.removeEventListener("creads-consent", on);
  }, []);
  useEffect(() => {
    if (!consented()) return;
    start();
    if (!started) return;
    // pause recording on private pages, resume elsewhere
    if (PRIVATE.test(path)) posthog.stopSessionRecording();
    else posthog.startSessionRecording();
  }, [path]);
  return null;
}
