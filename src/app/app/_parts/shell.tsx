"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "../../brand";
import AccountMenu, { CreditsPill } from "./account-menu";
import { useCredits } from "./use-credits";

// The platform frame: a left menu on desktop, a top bar with a slide-in menu on phones.

const I = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  spy: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9.5 16.5L16 16",
  create: "M12 5v14M5 12h14",
  film: "M4 5h16v14H4zM8 5v14M16 5v14M4 9.5h4M16 9.5h4M4 14.5h4M16 14.5h4",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  box: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
  mic: "M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3Zm-6 8a6 6 0 0 0 12 0M12 18v3",
  lib: "M5 4h4v16H5zM10 4h4v16h-4zM15.5 4.5l3.8 1-3.6 15-3.8-1",
  brain: "M12 5a3 3 0 0 0-5.6 1.5A3 3 0 0 0 5 12a3 3 0 0 0 2 5.5A3 3 0 0 0 12 19M12 5a3 3 0 0 1 5.6 1.5A3 3 0 0 1 19 12a3 3 0 0 1-2 5.5A3 3 0 0 1 12 19M12 5v14",
  lab: "M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 18l-5-9V3M7.5 14h9",
  menu: "M4 7h16M4 12h16M4 17h16",
  team: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M16.5 11a3 3 0 1 0 0-6M18 20a6 6 0 0 0-2.5-4.8",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  key: "M15 7a4 4 0 1 1-3.9 4.9L4 19v2h3v-2h2v-2h2l1.1-1.1A4 4 0 0 1 15 7Zm1 2h.01",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  close: "M6 6l12 12M18 6 6 18",
  pen: "M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4ZM13.5 6.5l4 4",
  spark: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15Z",
};

function Icon({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

type Item = { href: string; label: string; icon: string; soon?: boolean; external?: boolean; full?: boolean; badge?: string };
const NAV: { group?: string; items: Item[] }[] = [
  { items: [{ href: "/app", label: "Inicio", icon: I.home }] },
  { group: "Investigar", items: [{ href: "/app/spy", label: "Espiar anuncios", icon: I.spy, soon: true, full: true }] },
  {
    group: "Crear",
    items: [
      { href: "/app/guiones", label: "Generador de guiones", icon: I.pen, badge: "NUEVO" },
      { href: "/app/crear", label: "Crear anuncio", icon: I.create },
      { href: "/app/historias", label: "Historias animadas", icon: I.film, full: true },
      { href: "/app/herramientas", label: "Herramientas IA", icon: I.spark, full: true },
      { href: "/app/laboratorio", label: "Video e imagen IA", icon: I.lab, full: true },
    ],
  },
  {
    group: "Tu marca",
    items: [
      { href: "/app/avatares", label: "Avatares", icon: I.user },
      { href: "/app/productos", label: "Productos", icon: I.box },
      { href: "/app/voces", label: "Voces", icon: I.mic },
    ],
  },
  {
    group: "Biblioteca",
    items: [
      { href: "/app/videos", label: "En producción", icon: I.film },
      { href: "/app/biblioteca", label: "Anuncios terminados", icon: I.lib },
      { href: "/app/aprendizajes", label: "Aprendizajes", icon: I.brain, full: true },
    ],
  },
];

export interface ShellUser { email: string; name: string | null; role: "owner" | "admin" | "member"; owner: boolean; access: "full" | "ads" }

function navFor(user: ShellUser) {
  const account: Item[] = [{ href: "/app/planes", label: "Planes y créditos", icon: I.card }, { href: "/app/cuenta", label: "Mi cuenta", icon: I.key }];
  // giving access is the owner's alone
  if (user.owner) account.unshift({ href: "/app/equipo", label: "Equipo", icon: I.team });
  if (user.owner) account.push({ href: "/admin", label: "Panel interno", icon: I.chart, external: true });
  const groups = [...NAV, { group: "Cuenta", items: account }];
  if (user.access === "full") return groups;
  // "Solo anuncios": Crear anuncio and what it needs
  return groups.map((g) => ({ ...g, items: g.items.filter((i) => !i.full) })).filter((g) => g.items.length);
}

function Nav({ path, user, onPick }: { path: string; user: ShellUser; onPick?: () => void }) {
  return (
    <nav aria-label="Menú de la plataforma" className="flex flex-col gap-4">
      {navFor(user).map((g, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {g.group && <span className="px-3 pb-1 text-[11px] font-bold tracking-wider text-muted uppercase">{g.group}</span>}
          {g.items.map((it) => {
            const on = it.href === "/app" ? path === "/app" : path.startsWith(it.href);
            return (
              <Link key={it.href} href={it.href} onClick={onPick} prefetch={it.external ? false : undefined} aria-current={on ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${on ? "bg-accent/12 text-accent-text" : "text-muted hover:bg-surface-2 hover:text-ink"}`}>
                <Icon d={it.icon} />
                <span className="flex-1">{it.label}</span>
                {it.soon && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-muted">PRONTO</span>}
                {it.badge && <span className="rounded bg-[image:var(--grad)] px-1.5 py-0.5 text-[10px] font-bold text-white">{it.badge}</span>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Status() {
  const [h, setH] = useState<{ providers: { claude: boolean; database: boolean; video: Record<string, boolean>; image: Record<string, boolean>; voice: Record<string, boolean> } } | null>(null);
  useEffect(() => { fetch("/api/health").then((r) => r.json()).then(setH).catch(() => {}); }, []);
  if (!h?.providers) return null;
  const p = h.providers;
  const any = (o: Record<string, boolean>) => Object.values(o).some(Boolean);
  const items: [string, boolean][] = [["Base de datos", p.database], ["Claude", p.claude], ["Video", any(p.video)], ["Imagen", any(p.image)], ["Voz", any(p.voice)]];
  return (
    <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted" aria-label="Estado de los servicios">
      {items.map(([k, ok]) => (
        <li key={k} className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-good" : "bg-warn"}`} aria-hidden="true" />
          {k}<span className="sr-only">{ok ? " conectado" : " sin conectar"}</span>
        </li>
      ))}
    </ul>
  );
}

/** The account's credits in the menu (the owner has no limit). */
function CreditsBox() {
  const { info } = useCredits();
  const low = info && !info.unlimited && (info.balance ?? 0) < 100;
  return (
    <Link href="/app/planes" className="block rounded-xl bg-surface-2 p-3 hover:bg-surface-2/70">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-muted">Créditos</span>
        <span className={`font-mono text-sm font-bold ${low ? "text-warn" : ""}`}>
          {!info ? "…" : info.unlimited ? "Sin límite" : (info.balance ?? 0).toLocaleString("es-CL")}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        {!info ? "" : info.unlimited ? "Cuenta del dueño." : info.expired ? "Tu plan venció." : info.paidUntil ? `Plan al día hasta el ${new Date(`${info.paidUntil}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}.` : low ? "Te quedan pocos créditos." : "Comprar más créditos"}
      </p>
    </Link>
  );
}

/** Customers without a plan or credits: what to do next, on every screen but the plans page. */
function ActivatePlan() {
  const { info } = useCredits();
  if (!info || info.unlimited) return null;
  const empty = (info.balance ?? 0) <= 0;
  if (!empty && !info.expired) return null;
  const never = !info.plan && !info.paidUntil;
  return (
    <Link href="/app/planes" className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <span aria-hidden="true" className="pointer-events-none absolute -top-16 -left-10 h-40 w-40 rounded-full opacity-40 blur-[60px]" style={{ background: "var(--grad)" }} />
      <span className="relative flex flex-col gap-0.5">
        <b className="text-lg">{never ? "Activa tu plan para empezar a crear" : info.expired ? "Tu plan venció" : "Te quedaste sin créditos"}</b>
        <span className="text-sm text-muted">
          {never ? "Puedes recorrer todo el estudio. Para generar videos, imágenes y voces, elige un plan: el primer mes va con 50% de descuento." : info.expired ? "Renueva para seguir generando. Tus anuncios y archivos siguen aquí." : "Suma una recarga o sube de plan para seguir generando."}
        </span>
      </span>
      <span className="relative shrink-0 rounded-xl bg-[image:var(--grad)] px-4 py-2.5 text-center text-sm font-semibold text-white">{never ? "Ver planes con −50%" : info.expired ? "Renovar plan" : "Comprar créditos"}</span>
    </Link>
  );
}

/** Owner only: a thin warning when a service is running out of money. */
function MoneyAlerts() {
  const [alerts, setAlerts] = useState<{ service: string; name: string; text: string }[]>([]);
  useEffect(() => {
    fetch("/api/admin/saldos?alertas=1").then((r) => (r.ok ? r.json() : null)).then((d) => setAlerts(d?.alerts ?? [])).catch(() => {});
  }, []);
  if (!alerts.length) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm">
      <span className="font-semibold">{alerts.length === 1 ? alerts[0].text : `Revisa el saldo de ${alerts.map((a) => a.name).join(", ").replace(/, ([^,]*)$/, " y $1")}.`}</span>
      <a href="/admin" className="font-semibold text-accent-text hover:underline">Ver saldos</a>
    </div>
  );
}


export default function Shell({ children, user }: { children: React.ReactNode; user: ShellUser }) {
  const path = usePathname() ?? "/app";
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const footer = (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <CreditsBox />
      {user.owner && <Status />}
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      {/* desktop menu */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 overflow-y-auto border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="px-2"><Logo size={26} href="/app" gid="mark-aside" /></div>
        <div className="flex-1"><Nav path={path} user={user} /></div>
        {footer}
      </aside>

      {/* phone top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface px-4 py-3 lg:hidden">
        <Logo size={24} href="/app" gid="mark-top" />
        <div className="flex items-center gap-2">
          <CreditsPill />
          <AccountMenu user={user} />
          <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menú" aria-expanded={open} className="grid h-9 w-9 place-items-center rounded-lg border border-line">
            <Icon d={I.menu} />
          </button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40" />
          <div className="absolute inset-y-0 left-0 flex w-[min(300px,85vw)] flex-col gap-6 overflow-y-auto bg-surface px-3 py-5">
            <div className="flex items-center justify-between px-2">
              <Logo size={24} href="/app" gid="mark-drawer" />
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar menú" className="grid h-9 w-9 place-items-center rounded-lg border border-line"><Icon d={I.close} /></button>
            </div>
            <div className="flex-1"><Nav path={path} user={user} onPick={() => setOpen(false)} /></div>
            {footer}
          </div>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:pt-4 lg:pb-8">
        {/* desktop: the account corner */}
        <div className="mx-auto mb-4 hidden max-w-6xl items-center justify-end gap-2 lg:flex">
          <CreditsPill />
          <AccountMenu user={user} />
        </div>
        <div className="mx-auto flex max-w-6xl flex-col gap-6">{user.owner && <MoneyAlerts />}{!user.owner && !path.startsWith("/app/planes") && <ActivatePlan />}{children}</div>
      </main>
    </div>
  );
}
