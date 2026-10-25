import { Logo } from "./brand";
import ThemeToggle from "./theme-toggle";

// Shared frame of the free tools (/generador-de-hooks, /plantilla-meta): same header and footer as /afiliados.

export const gutter = "px-[max(16px,env(safe-area-inset-left,0px))]";
export const wrap = "mx-auto w-full max-w-6xl";
export const h2 = "font-display text-[1.7rem] leading-[1.1] font-semibold sm:text-[2.3rem]";

export const HERRAMIENTAS = [
  { href: "/generador-de-hooks", label: "Generador de hooks" },
  { href: "/plantilla-meta", label: "Plantilla para Meta Ads" },
] as const;

export function HerramientaShell({ children }: { children: React.ReactNode }) {
  return (
    <div lang="es" className="overflow-x-clip bg-bg">
      <header className="border-b border-line/60">
        <div className={`${wrap} flex items-center justify-between gap-3 py-3 ${gutter}`}>
          <Logo href="/" />
          <div className="flex items-center gap-2">
            <ThemeToggle lang="es" />
            <a href="/app" className="px-2 text-sm font-semibold text-muted hover:text-ink">Entrar</a>
            <a href="/registro" className="rounded-xl bg-ink px-4 py-2 text-sm font-semibold text-bg">Crear cuenta</a>
          </div>
        </div>
      </header>
      <main className="flex flex-col gap-16 py-10 sm:gap-20 sm:py-16">{children}</main>
      <footer className={`border-t border-line ${gutter}`}>
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-3 py-6 text-sm text-muted`}>
          <span>© {new Date().getFullYear()} Creads IA · hola@creadsia.com</span>
          <nav aria-label="Herramientas gratis y legal" className="flex flex-wrap gap-4">
            {HERRAMIENTAS.map((h) => <a key={h.href} href={h.href} className="hover:text-ink">{h.label}</a>)}
            <a href="/terminos" className="hover:text-ink">Términos y condiciones</a>
            <a href="/privacidad" className="hover:text-ink">Privacidad</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
