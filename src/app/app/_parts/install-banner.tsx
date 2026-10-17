"use client";

import { useEffect, useState } from "react";
import { IosSteps, useInstall } from "../../install-app";

const KEY = "creads-install-hidden";

/** On phones: a small card offering to install Creads as an app (hidden once installed or dismissed). */
export default function InstallBanner() {
  const { mode, install } = useInstall();
  const [hidden, setHidden] = useState(true);
  const [steps, setSteps] = useState(false);
  useEffect(() => {
    try { setHidden(Date.now() - Number(localStorage.getItem(KEY) || 0) < 14 * 86400_000); } catch { setHidden(false); }
  }, []);
  if (hidden || (mode !== "prompt" && mode !== "ios")) return null;
  const hide = () => { setHidden(true); try { localStorage.setItem(KEY, String(Date.now())); } catch {} };
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 lg:hidden" role="region" aria-label="Instalar la app">
      <div className="flex items-start gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={44} height={44} className="rounded-xl" />
        <div className="flex min-w-0 flex-1 flex-col">
          <b className="text-sm">Instala Creads en tu celular</b>
          <span className="text-xs text-muted">Ábrelo desde tu pantalla de inicio, a pantalla completa, como cualquier app.</span>
        </div>
        <button type="button" onClick={hide} aria-label="Ahora no" className="text-lg leading-none text-muted">×</button>
      </div>
      {mode === "prompt" ? (
        <button type="button" onClick={() => install().then((ok) => ok && hide())} className="self-start rounded-lg bg-[image:var(--grad)] px-4 py-2 text-sm font-semibold text-white">Instalar la app</button>
      ) : steps ? <IosSteps /> : (
        <button type="button" onClick={() => setSteps(true)} className="self-start rounded-lg bg-[image:var(--grad)] px-4 py-2 text-sm font-semibold text-white">Cómo instalarla</button>
      )}
    </div>
  );
}
