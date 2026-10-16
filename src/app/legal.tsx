import Link from "next/link";
import { Logo } from "./brand";

// Shared layout for the legal pages: readable text column, the date of the version, a way back home.
export default function Legal({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div lang="es" className="min-h-screen bg-bg">
      <header className="border-b border-line/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <Logo href="/" />
          <Link href="/" className="text-sm font-semibold text-muted hover:text-ink">Volver al inicio</Link>
        </div>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-10 sm:px-6">
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
        <p className="text-sm text-muted">Última actualización: {updated}</p>
        <div className="legal mt-6 flex flex-col gap-4 leading-relaxed [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-[15px] [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:text-[15px]">
          {children}
        </div>
      </main>
    </div>
  );
}
