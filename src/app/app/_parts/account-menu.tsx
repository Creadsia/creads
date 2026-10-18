"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCredits } from "./use-credits";
import { WHATSAPP, whatsappLink } from "../../whatsapp";
import { IosSteps, useInstall } from "../../install-app";
import type { ShellUser } from "./shell";

// The account corner every logged-in screen has: credits at a glance and a menu with the account,
// plans, team, support, light/dark and sign out.

const PLAN_NAMES: Record<string, string> = { starter: "Starter", plus: "Plus", studio: "Studio" };
const THEME_KEY = "creads-theme";

function initials(user: ShellUser) {
  const base = (user.name || user.email.split("@")[0]).trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

async function logout() {
  await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/app";
}

function Svg({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const D = {
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  team: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M16.5 11a3 3 0 1 0 0-6M18 20a6 6 0 0 0-2.5-4.8",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  phone: "M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm3 17h2",
  out: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10",
  coin: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v8M9.5 10.5c0-1 1.1-1.5 2.5-1.5s2.5.6 2.5 1.5-1 1.3-2.5 1.5-2.5.6-2.5 1.5 1.1 1.5 2.5 1.5 2.5-.5 2.5-1.5",
};

/** Credits pill: balance, and a quick way to buy more. */
export function CreditsPill() {
  const { info } = useCredits();
  const low = info && !info.unlimited && (info.balance ?? 0) < 100;
  return (
    <Link href="/app/planes" title="Planes y créditos" data-tour="creditos"
      className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-surface-2 ${low ? "border-warn/50 text-warn" : "border-line"}`}>
      <Svg d={D.coin} />
      <span className="font-mono">{!info ? "…" : info.unlimited ? "∞" : (info.balance ?? 0).toLocaleString("es-CL")}</span>
      <span className="hidden text-muted sm:inline">créditos</span>
    </Link>
  );
}

export default function AccountMenu({ user, up = false }: { user: ShellUser; up?: boolean }) {
  const { info } = useCredits();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState<boolean | null>(null);
  const app = useInstall();
  const [ios, setIos] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const set = document.documentElement.dataset.theme;
    setDark(set ? set === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); btn.current?.focus(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = Array.from(box.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
        if (!items.length) return;
        e.preventDefault();
        const i = items.indexOf(document.activeElement as HTMLElement);
        items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    box.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  function flipTheme() {
    const next = !dark;
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem(THEME_KEY, next ? "dark" : "light"); } catch {}
    setDark(next);
  }

  const plan = info?.unlimited ? "Cuenta del dueño" : info?.plan ? `Plan ${PLAN_NAMES[info.plan.toLowerCase()] ?? info.plan}${info.expired ? " · vencido" : ""}` : "Sin plan activo";
  const until = info?.paidUntil && !info.expired ? new Date(`${info.paidUntil}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "long" }) : null;
  const role = user.owner ? (user.role === "admin" ? "Socio" : "Dueño") : user.role === "admin" ? "Socio" : user.access === "ads" ? "Solo anuncios" : "Acceso completo";

  const item = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-ink outline-none hover:bg-surface-2 focus-visible:bg-surface-2";
  const close = () => setOpen(false);

  return (
    <div ref={box} className="relative">
      <button ref={btn} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Menú de tu cuenta"
        className="flex items-center gap-2 rounded-full border border-line bg-surface p-0.5 pr-0.5 transition-colors hover:bg-surface-2 sm:pr-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[image:var(--grad)] text-xs font-bold text-white">{initials(user)}</span>
        <span className="hidden max-w-[140px] truncate text-sm font-semibold sm:inline">{user.name || user.email.split("@")[0]}</span>
      </button>

      {open && (
        <div role="menu" aria-label="Tu cuenta"
          className={`absolute right-0 z-50 w-[min(300px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-2 shadow-xl ${up ? "bottom-full mb-2" : "top-full mt-2"}`}>
          <div className="flex items-center gap-3 px-3 pt-2 pb-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[image:var(--grad)] text-sm font-bold text-white">{initials(user)}</span>
            <span className="flex min-w-0 flex-col">
              <b className="truncate text-sm">{user.name || user.email.split("@")[0]}</b>
              <span className="truncate text-xs text-muted">{user.email}</span>
              <span className="truncate text-xs text-muted">{role}</span>
            </span>
          </div>

          <div className="mx-1 mb-2 rounded-xl bg-surface-2 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-muted">{plan}</span>
              <span className="font-mono text-sm font-bold">{!info ? "…" : info.unlimited ? "Sin límite" : `${(info.balance ?? 0).toLocaleString("es-CL")} créditos`}</span>
            </div>
            {until && <p className="mt-0.5 text-xs text-muted">Tus créditos vencen el {until}</p>}
            {!info?.unlimited && (
              <Link href="/app/planes" role="menuitem" onClick={close}
                className="mt-2 block rounded-lg bg-[image:var(--grad)] px-3 py-1.5 text-center text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-accent">
                {info?.expired || !info?.plan ? "Activar plan" : "Comprar créditos"}
              </Link>
            )}
          </div>

          <Link href="/app/cuenta" role="menuitem" onClick={close} className={item}><Svg d={D.user} />Mi cuenta</Link>
          <Link href="/app/planes" role="menuitem" onClick={close} className={item}><Svg d={D.card} />Planes y créditos</Link>
          {user.owner && <Link href="/app/equipo" role="menuitem" onClick={close} className={item}><Svg d={D.team} />Equipo</Link>}
          {user.owner && <a href="/admin" role="menuitem" className={item}><Svg d={D.chart} />Panel interno</a>}
          <Link href="/app/ayuda" role="menuitem" onClick={close} className={item}><Svg d={D.help} />Centro de ayuda</Link>
          {WHATSAPP && <a href={whatsappLink("Hola, necesito ayuda con Creads IA")} target="_blank" rel="noopener noreferrer" role="menuitem" className={item}><Svg d={D.phone} />Ayuda por WhatsApp</a>}
          {(app.mode === "prompt" || app.mode === "ios") && (
            <button type="button" role="menuitem" onClick={() => (app.mode === "prompt" ? app.install().then(close) : setIos((v) => !v))} className={item}>
              <Svg d={D.phone} />Instalar la app
            </button>
          )}
          {ios && app.mode === "ios" && <div className="mx-3 mb-1 rounded-lg bg-surface-2 p-3"><IosSteps /></div>}
          <button type="button" role="menuitem" onClick={flipTheme} className={item}>
            <Svg d={dark ? D.sun : D.moon} />{dark ? "Modo claro" : "Modo oscuro"}
          </button>

          <div className="my-1 border-t border-line" />
          <button type="button" role="menuitem" onClick={logout} className={item.replace("text-ink", "text-bad")}><Svg d={D.out} />Cerrar sesión</button>
        </div>
      )}
    </div>
  );
}
