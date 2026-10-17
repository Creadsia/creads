"use client";

import { useEffect } from "react";

// Crashes in the visitor's browser go to Creads' error log (a few per page at most; noise from
// browser extensions and blocked scripts is ignored).

const NOISE = /ResizeObserver loop|Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|Non-Error promise rejection|Load failed|Failed to fetch|NetworkError|AbortError|The operation was aborted|cancelled|cancelado/i;
let sent = 0;

export function reportClientError(message: string, extra = "") {
  const msg = `${message}${extra ? ` · ${extra}` : ""}`.slice(0, 500);
  if (!msg.trim() || NOISE.test(msg) || sent >= 5) return;
  sent++;
  const body = JSON.stringify({ message: msg, path: location.pathname });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon("/api/errores", new Blob([body], { type: "application/json" }));
    else void fetch("/api/errores", { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true });
  } catch {}
}

export default function ErrorCatcher() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (!e.message) return;
      const at = e.filename ? `${e.filename.replace(location.origin, "").split("?")[0]}:${e.lineno}` : "";
      if (at && !at.startsWith("/")) return; // a script from another site (extension, ad blocker)
      reportClientError(e.message, at);
    };
    const onReject = (e: PromiseRejectionEvent) => {
      const r = e.reason as { message?: string } | string | undefined;
      reportClientError(typeof r === "string" ? r : r?.message ?? "");
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onReject);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onReject); };
  }, []);
  return null;
}
