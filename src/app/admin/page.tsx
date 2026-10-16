import type { Metadata } from "next";
import { Logo } from "../brand";
import { adminConfigured, isAdmin } from "@/lib/admin";
import AdminLogin from "./login";
import AdminPanel from "./panel";
import ThemeToggle from "../theme-toggle";

export const metadata: Metadata = {
  title: "Panel · Creads",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const ok = await isAdmin();
  return (
    <main lang="es" className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Logo size={26} href="/" />
          <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold tracking-wide text-muted uppercase">Panel interno</span>
        </div>
        <ThemeToggle lang="es" />
      </header>
      {ok ? <AdminPanel /> : <AdminLogin configured={adminConfigured()} />}
    </main>
  );
}
