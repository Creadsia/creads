"use client";

import { useEffect, useState } from "react";

// Light / dark switch. The choice is remembered on this browser and applied before paint by the
// script in layout.tsx; with no choice the page follows the device setting.
const KEY = "creads-theme";

export default function ThemeToggle({ lang = "en" }: { lang?: "en" | "es" }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    const set = document.documentElement.dataset.theme;
    setDark(set ? set === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  function flip() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {}
    setDark(next);
  }

  const label = lang === "es" ? (dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro") : dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={flip}
      aria-label={label}
      title={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-muted transition-colors hover:text-ink"
    >
      {/* Before hydration we don't know the theme: show nothing rather than the wrong icon. */}
      {dark === null ? null : dark ? (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
