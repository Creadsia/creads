import type { Metadata } from "next";
import { Logo } from "../brand";
import { currentUser, panelAccess } from "@/lib/admin";
import AdminPanel from "./panel";
import ThemeToggle from "../theme-toggle";

export const metadata: Metadata = {
  title: "Panel · Creads",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  const access = await panelAccess(user);
  const ok = access === "ok";
  return (
    <main lang="es" className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo size={26} href="/app" />
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold tracking-wide text-muted uppercase">Panel interno</span>
        </div>
        <nav aria-label="Volver" className="flex flex-wrap items-center gap-2">
          <a href="/app" className="rounded-lg border border-line px-3 py-2 text-sm font-semibold hover:bg-surface-2">← Volver al estudio</a>
          <a href="/app/crear" className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-bg">Crear anuncio</a>
          <ThemeToggle lang="es" />
        </nav>
      </header>
      {ok ? (
        <AdminPanel />
      ) : (
        <section className="mx-auto mt-10 flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
          <h1 className="font-display text-2xl font-extrabold">Panel del dueño</h1>
          <p className="text-sm text-muted">{access === "2fa" ? "Para entrar al Panel como socio, primero activa la verificación en dos pasos en Mi cuenta → Seguridad." : user ? "Esta sección es solo para el dueño y sus socios." : "Entra con tu cuenta para ver las finanzas y la administración."}</p>
          <a href={access === "2fa" ? "/app/cuenta" : "/app"} className="rounded-lg bg-accent px-4 py-2 text-center font-semibold text-accent-ink">{access === "2fa" ? "Activar verificación en dos pasos" : user ? "Volver a la plataforma" : "Entrar"}</a>
        </section>
      )}
    </main>
  );
}
