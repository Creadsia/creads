import type { Metadata } from "next";
import Image from "next/image";
import Studio from "./studio";

export const metadata: Metadata = {
  title: "Estudio · Creads",
  robots: { index: false, follow: false },
};

export default function EstudioPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6">
      <header className="flex items-center gap-3">
        <Image src="/logo.svg" alt="" width={28} height={28} />
        <span className="font-semibold tracking-tight">
          Cre<span className="grad-text">ads</span> <span className="font-normal text-muted">· Estudio</span>
        </span>
      </header>
      <Studio />
    </main>
  );
}
