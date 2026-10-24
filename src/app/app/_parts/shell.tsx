"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "../../brand";
import AccountMenu, { CreditsPill } from "./account-menu";
import InstallBanner from "./install-banner";
import Assistant from "./assistant";
import FailNotices from "./fail-notices";
import { Guides, HelpButton } from "./tour";
import { fmtCredits } from "@/lib/credit-math";
import { useCredits } from "./use-credits";
import CreditsPopup from "./credits-popup";
import { openUpgrade } from "./buy";

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
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-2.5-11.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01",
  redo: "M4 12a8 8 0 0 1 14-5.3M20 4v5h-5M20 12a8 8 0 0 1-14 5.3M4 20v-5h5",
  spark: "M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3ZM18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9L18 15Z",
};

function Icon({ d, className = "h-[18px] w-[18px]" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

type Item = { href: string; label: string; icon: string; owner?: boolean; soon?: boolean; external?: boolean; full?: boolean; badge?: string; step?: number; optional?: boolean };
// The menu follows how a campaign is made: spy what works → write the script → make the ad (its
// formats include animated stories). The brand is set up once; standalone AI tools come last.
const NAV: { group?: string; hint?: string; items: Item[]; more?: boolean }[] = [
  { items: [{ href: "/app", label: "Inicio", icon: I.home }] },
  {
    group: "Haz tu anuncio",
    items: [
      { href: "/app/automatico", label: "Automático (conversando)", icon: I.spark },
      { href: "/app/spy", label: "Espiar anuncios", icon: I.spy, step: 1, full: true, optional: true },
      { href: "/app/guiones", label: "Crear guion", icon: I.pen, step: 2 },
      { href: "/app/crear?paso=voz", label: "Grabar la voz", icon: I.mic, step: 3 },
      { href: "/app/crear", label: "Escenas, video y edición", icon: I.create, step: 4 },
    ],
  },
  {
    group: "Tu marca",
    hint: "Se configura una vez",
    items: [
      { href: "/app/voces", label: "Voces", icon: I.mic, step: 1 },
      { href: "/app/avatares", label: "Avatares", icon: I.user, step: 2 },
      { href: "/app/productos", label: "Productos", icon: I.box, step: 3, optional: true },
    ],
  },
  {
    group: "Biblioteca",
    items: [
      { href: "/app/videos", label: "En producción", icon: I.film },
      { href: "/app/biblioteca", label: "Anuncios terminados", icon: I.lib },
      { href: "/app/aprendizajes", label: "Aprendizajes", icon: I.brain, full: true, owner: true },
    ],
  },
  {
    group: "Herramientas",
    items: [
      { href: "/app/prompts", label: "Generador de prompts", icon: I.pen },
    ],
  },
  // Herramientas IA, Recrear video, Influencer IA and Historias are hidden since 21 Oct 2026 (owner and Benjamín:
  // Creads sells UGC ads and images); their pages stay in the code and open only by their address.
  {
    group: "Imágenes",
    items: [
      { href: "/app/laboratorio", label: "Imágenes para anuncios", icon: I.image, full: true },
    ],
  },
];

// pages seen in this visit, to know whether "Atrás" can go back inside the studio
const trail: string[] = [];
function useTrail(path: string) {
  useEffect(() => { if (trail[trail.length - 1] !== path) trail.push(path); }, [path]);
}

/** "← Atrás": the previous page in the studio, or the section's start when there isn't one. */
function BackButton({ path }: { path: string }) {
  const router = useRouter();
  function back() {
    if (trail.length > 1) { trail.pop(); router.back(); }
    else router.push(path.split("/").slice(0, -1).join("/") || "/app");
  }
  return (
    <button type="button" onClick={back} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-ink">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      Atrás
    </button>
  );
}

export interface ShellUser { email: string; name: string | null; role: "owner" | "admin" | "member"; owner: boolean; access: "full" | "ads" }

function navFor(user: ShellUser) {
  const account: Item[] = [{ href: "/app/planes", label: "Planes", icon: I.card }, { href: "/app/cuenta", label: "Mi cuenta", icon: I.key }, { href: "/app/ayuda", label: "Centro de ayuda", icon: I.help }];
  // giving access is the owner's alone
  if (user.owner) account.unshift({ href: "/app/equipo", label: "Equipo", icon: I.team });
  if (user.owner) account.push({ href: "/admin", label: "Panel interno", icon: I.chart, external: true });
  const groups = [...NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.owner || user.owner) })), { group: "Cuenta", items: account }];
  const visible = user.access === "full" ? groups : groups.map((g) => ({ ...g, items: g.items.filter((i) => !i.full) })).filter((g) => g.items.length); // "Solo anuncios"
  // number the steps in the order they're shown
  return visible.map((g) => { let n = 0; return { ...g, items: g.items.map((i) => (i.step ? { ...i, step: ++n } : i)) }; });
}

function Nav({ path, user, onPick }: { path: string; user: ShellUser; onPick?: () => void }) {
  const groups = navFor(user);
  const inMore = groups.some((g) => g.more && g.items.some((it) => path.startsWith(it.href)));
  // open unless the customer folded it (remembered on this browser)
  const [moreOpen, setMoreOpen] = useState(true);
  useEffect(() => { try { if (localStorage.getItem("creads-more") === "0" && !inMore) setMoreOpen(false); } catch {} }, [inMore]);
  const toggleMore = () => setMoreOpen((v) => { try { localStorage.setItem("creads-more", v ? "0" : "1"); } catch {} return !v; });
  return (
    <nav aria-label="Menú de la plataforma" className="flex flex-col gap-4">
      {groups.map((g, i) => {
        const open = !g.more || moreOpen;
        return (
          <div key={i} className="flex flex-col gap-0.5" data-tour={g.group === "Haz tu anuncio" ? "nav-campana" : g.group === "Tu marca" ? "nav-marca" : undefined}>
            {g.group && (g.more ? (
              <button type="button" onClick={toggleMore} aria-expanded={open} className="flex items-center justify-between px-3 pb-1 text-[11px] font-bold tracking-wider text-muted uppercase hover:text-ink">
                {g.group}<span aria-hidden="true" className={`transition-transform ${open ? "rotate-90" : ""}`}>›</span>
              </button>
            ) : (
              <span className="flex items-baseline justify-between gap-2 px-3 pb-1 text-[11px] font-bold tracking-wider text-muted uppercase">{g.group}{g.hint && <span className="font-medium tracking-normal normal-case">{g.hint}</span>}</span>
            ))}
            {open && g.items.map((it) => {
              const on = it.href.includes("?") ? false : it.href === "/app" ? path === "/app" : path.startsWith(it.href) || (it.href === "/app/crear" && path.startsWith("/app/historias"));
              return (
                <Link key={it.href} href={it.href} onClick={() => { onPick?.(); if (it.href.includes("?paso=")) setTimeout(() => window.dispatchEvent(new Event("creads-paso")), 50); }} prefetch={it.external ? false : undefined} aria-current={on ? "page" : undefined}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${on ? "bg-accent/12 text-accent-text" : "text-muted hover:bg-surface-2 hover:text-ink"}`}>
                  {it.step ? <span aria-hidden="true" className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border text-[10px] font-bold ${on ? "border-current" : "border-line"}`}>{it.step}</span> : <Icon d={it.icon} />}
                  <span className="flex-1">{it.step ? <span className="sr-only">Paso {it.step}: </span> : null}{it.label}{it.optional && <span className="ml-1.5 text-[11px] font-medium text-muted">(opcional)</span>}</span>
                  {it.soon && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold text-muted">PRONTO</span>}
                  {it.badge && <span className="rounded bg-[image:var(--grad)] px-1.5 py-0.5 text-[10px] font-bold text-white">{it.badge}</span>}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Phones (owner, 24 Oct 2026: almost every customer arrives on a phone): an app-style tab bar with the four
 * places people use most and «Más» for the full menu.
 */
function MobileTabs({ path, user, onMore, moreOpen }: { path: string; user: ShellUser; onMore: () => void; moreOpen: boolean }) {
  const tabs = [
    { href: "/app", label: "Inicio", icon: I.home, on: path === "/app" },
    { href: "/app/automatico", label: "Automático", icon: I.spark, on: path.startsWith("/app/automatico") },
    user.access === "full"
      ? { href: "/app/laboratorio", label: "Imágenes", icon: I.image, on: path.startsWith("/app/laboratorio") }
      : { href: "/app/crear", label: "Crear", icon: I.create, on: path.startsWith("/app/crear") },
    { href: "/app/biblioteca", label: "Mis anuncios", icon: I.lib, on: path.startsWith("/app/biblioteca") || path.startsWith("/app/videos") },
  ];
  return (
    <nav aria-label="Navegación principal" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map((t) => (
          <li key={t.href}>
            <Link href={t.href} aria-current={t.on ? "page" : undefined} className={`flex flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 text-[11px] font-semibold ${t.on ? "text-accent-text" : "text-muted"}`}>
              <span className={`grid h-7 w-12 place-items-center rounded-full ${t.on ? "bg-accent/15" : ""}`}><Icon d={t.icon} className="h-5 w-5" /></span>
              {t.label}
            </Link>
          </li>
        ))}
        <li>
          <button type="button" data-tour="nav-menu" onClick={onMore} aria-expanded={moreOpen} className={`flex w-full flex-col items-center gap-0.5 px-1 pt-2 pb-1.5 text-[11px] font-semibold ${moreOpen ? "text-accent-text" : "text-muted"}`}>
            <span className="grid h-7 w-12 place-items-center rounded-full"><Icon d={I.menu} className="h-5 w-5" /></span>
            Más
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** The account's credits in the menu (the owner has no limit). */
function CreditsBox() {
  const { info } = useCredits();
  const low = Boolean(info && !info.unlimited && (info.balance ?? 0) < 340); // less than ≈ 30 s of video
  return (
    <Link href="/app/planes" data-tour="creditos" className="block rounded-xl bg-surface-2 p-3 hover:bg-surface-2/70">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-muted">Tus créditos</span>
        <span className={`font-mono text-sm font-bold ${low ? "text-warn" : ""}`}>
          {!info ? "…" : info.unlimited ? "Sin límite" : fmtCredits(info.balance ?? 0)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted">
        {!info ? "" : info.unlimited ? "Cuenta del dueño." : info.expired ? "Tu plan venció." : info.paidUntil ? `Plan al día hasta el ${new Date(`${info.paidUntil}T12:00:00`).toLocaleDateString("es-CL", { day: "numeric", month: "short" })}.` : low ? "Te quedan pocos créditos." : "Sumar más créditos"}
      </p>
    </Link>
  );
}

/** «Mejorar»: always one tap from paying, for customers without an active plan (phone header and desktop corner). */
function UpgradeButton() {
  const { info } = useCredits();
  if (!info || info.unlimited || info.owner || (info.paidUntil && !info.expired)) return null;
  return (
    <button type="button" onClick={openUpgrade} className="whitespace-nowrap rounded-full bg-[image:var(--grad)] px-3 py-1.5 text-sm font-semibold text-white shadow-[0_8px_24px_-10px_rgba(255,43,214,0.8)] active:scale-[0.98]">
      Mejorar
    </button>
  );
}

/** The free trial, said plainly at the top of every screen: what's left and one tap to choose a plan. */
function TrialStrip() {
  const { info } = useCredits();
  if (!info || info.unlimited || info.owner || info.plan || info.paidUntil || (info.balance ?? 0) <= 0) return null;
  return (
    <button type="button" onClick={openUpgrade} className="flex w-full items-center justify-between gap-3 rounded-xl border border-accent/40 bg-accent/[0.07] px-3 py-2 text-left text-sm">
      <span className="min-w-0"><b>Prueba gratis</b> <span className="text-muted">· te quedan {(info.balance ?? 0).toLocaleString("es-CL")} créditos</span></span>
      <span className="shrink-0 font-semibold text-accent-text">Elegir plan ›</span>
    </button>
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
    <button type="button" onClick={openUpgrade} className="relative flex w-full flex-col gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-4 text-left sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <span aria-hidden="true" className="pointer-events-none absolute -top-16 -left-10 h-40 w-40 rounded-full opacity-40 blur-[60px]" style={{ background: "var(--grad)" }} />
      <span className="relative flex flex-col gap-0.5">
        <b className="text-lg">{never ? "Activa tu plan para empezar a crear" : info.expired ? "Tu plan venció" : "Te quedaste sin créditos"}</b>
        <span className="text-sm text-muted">
          {never ? "Puedes recorrer todo el estudio. Para seguir generando videos, imágenes y voces, elige un plan desde US$25 al mes." : info.expired ? "Renueva para seguir generando. Tus anuncios y archivos siguen aquí." : "Suma una recarga o sube de plan para seguir generando."}
        </span>
      </span>
      <span className="relative shrink-0 rounded-xl bg-[image:var(--grad)] px-4 py-2.5 text-center text-sm font-semibold text-white">{never ? "Ver planes" : info.expired ? "Renovar plan" : "Sumar créditos"}</span>
    </button>
  );
}

/** Owner only: a thin warning when a service is running out of money. */
function MoneyAlerts() {
  const [alerts, setAlerts] = useState<{ service: string; name: string; text: string }[]>([]);
  const load = () => fetch("/api/admin/saldos?alertas=1").then((r) => (r.ok ? r.json() : null)).then((d) => setAlerts(d?.alerts ?? [])).catch(() => {});
  useEffect(() => { load(); }, []);
  // "ya lo resolví": forgets the recorded failures (a balance that is still low shows up again by itself)
  async function solved() {
    await Promise.all([...new Set(alerts.map((a) => a.service))].map((svc) => fetch("/api/admin/saldos", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ listo: svc }) }).catch(() => null)));
    setAlerts([]);
    setTimeout(load, 1500);
  }
  if (!alerts.length) return null;
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm">
      <span className="font-semibold">{alerts.length === 1 ? alerts[0].text : `Revisa el saldo de ${alerts.map((a) => a.name).join(", ").replace(/, ([^,]*)$/, " y $1")}.`}</span>
      <span className="flex gap-3">
        <button type="button" onClick={solved} className="font-semibold text-muted hover:text-ink hover:underline">Ya lo resolví</button>
        <a href="/admin" className="font-semibold text-accent-text hover:underline">Ver saldos</a>
      </span>
    </div>
  );
}


export default function Shell({ children, user }: { children: React.ReactNode; user: ShellUser }) {
  const path = usePathname() ?? "/app";
  useTrail(path);
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const footer = (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <CreditsBox />
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
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-surface/95 px-4 pt-[max(8px,env(safe-area-inset-top))] pb-2 backdrop-blur lg:hidden">
        <Logo size={22} href="/app" gid="mark-top" />
        <div className="flex items-center gap-1.5">
          <CreditsPill />
          {!user.owner && <UpgradeButton />}
          <AccountMenu user={user} />
        </div>
      </header>
      <MobileTabs path={path} user={user} onMore={() => setOpen(true)} moreOpen={open} />
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

      <main className="min-w-0 px-4 pt-3 pb-[calc(88px+env(safe-area-inset-bottom))] sm:px-6 lg:px-10 lg:pt-4 lg:pb-8">
        {/* back, and (desktop) the account corner */}
        <div className="mx-auto mb-2 flex max-w-6xl items-center justify-between gap-2 lg:mb-4">
          {path !== "/app" ? <span className={["/app/automatico", "/app/laboratorio", "/app/biblioteca"].includes(path) ? "hidden lg:block" : ""}><BackButton path={path} /></span> : <span />}
          <div className="ml-auto flex items-center gap-2">
            <HelpButton />
            <span className="hidden items-center gap-2 lg:flex">
              <CreditsPill />
              {!user.owner && <UpgradeButton />}
              <AccountMenu user={user} />
            </span>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:gap-6"><InstallBanner /><FailNotices />{user.owner && <MoneyAlerts />}{!user.owner && !path.startsWith("/app/planes") && <ActivatePlan />}{!user.owner && !path.startsWith("/app/planes") && <TrialStrip />}{children}</div>
      </main>
      <Assistant />
      <Guides />
      {!user.owner && <CreditsPopup />}
    </div>
  );
}
