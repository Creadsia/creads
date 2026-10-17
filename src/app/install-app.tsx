"use client";

import { useEffect, useState } from "react";

// Creads as an app: registers the service worker, remembers the browser's "install" offer, and gives
// the studio an "Instalar la app" button (Android/desktop: one tap; iPhone: Share → Agregar a inicio).

interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

let deferred: InstallEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((f) => f());

/** Mounted once in the root layout. */
export function PwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const onPrompt = (e: Event) => { e.preventDefault(); deferred = e as InstallEvent; notify(); };
    const onInstalled = () => {
      deferred = null; notify();
      fetch("/api/app-instalada", { method: "POST" }).catch(() => {}); // counted for the owner's summary
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  return null;
}

export function useInstall() {
  const [, force] = useState(0);
  const [env, setEnv] = useState<{ standalone: boolean; ios: boolean } | null>(null);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    const nav = navigator as Navigator & { standalone?: boolean };
    setEnv({
      standalone: window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true,
      ios: /iphone|ipad|ipod/i.test(navigator.userAgent),
    });
    return () => { listeners.delete(f); };
  }, []);
  const canPrompt = Boolean(deferred);
  async function install() {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null; notify();
    return outcome === "accepted";
  }
  /** null until known; "installed" inside the app; "prompt" one tap; "ios" needs the Share menu; "none" not offered. */
  const mode = !env ? null : env.standalone ? "installed" : canPrompt ? "prompt" : env.ios ? "ios" : "none";
  return { mode, install };
}

/** The steps for iPhone (Safari has no install button). */
export function IosSteps() {
  return (
    <ol className="flex flex-col gap-1 text-sm">
      <li>1. Abre creadsia.com/app en <b>Safari</b>.</li>
      <li>2. Toca <b>Compartir</b> <span aria-hidden="true">(el cuadrado con la flecha ↑)</span>.</li>
      <li>3. Elige <b>Agregar a inicio</b> y toca <b>Agregar</b>.</li>
    </ol>
  );
}
