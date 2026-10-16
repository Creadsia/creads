import type { Metadata } from "next";
import { Logo } from "../brand";
import { currentUser } from "@/lib/admin";
import AdminPanel from "./panel";
import ThemeToggle from "../theme-toggle";

export const metadata: Metadata = {
  title: "Panel · Creads",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await currentUser();
  const ok = user?.role === "owner";
  return (
    <main lang="es" className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo size={26} href="/" />
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold tracking-wide text-muted uppercase">Panel interno</span>
        </div>
        <ThemeToggle lang="es" />
      </header>
      {ok ? (
        <AdminPanel />
      ) : (
        <section className="mx-auto mt-10 flex w-full max-w-sm flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
          <h1 className="font-display text-2xl font-extrabold">Panel del dueño</h1>
          <p className="text-sm text-muted">{user ? "Esta sección es solo para la cuenta del dueño." : "Entra con tu cuenta de dueño para ver las finanzas y la administración."}</p>
          <a href="/app" className="rounded-lg bg-accent px-4 py-2 text-center font-semibold text-accent-ink">{user ? "Volver a la plataforma" : "Entrar"}</a>
        </section>
      )}
    </main>
  );
}
