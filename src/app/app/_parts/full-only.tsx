import Link from "next/link";
import { currentUser } from "@/lib/admin";
import { hasFullStudio, isOwner } from "@/lib/auth";

// Server-side gates for pages outside "Crear anuncio" (the API refuses too; this just explains why).

export async function FullOnly({ children }: { children: React.ReactNode }) {
  if (hasFullStudio(await currentUser())) return <>{children}</>;
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
      <p className="font-semibold">Tu acceso es solo para crear anuncios</p>
      <p className="max-w-md text-sm text-muted">Esta sección es parte del acceso completo. Si la necesitas, pídesela al dueño de Creads.</p>
      <Link href="/app/crear" className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">Ir a Crear anuncio</Link>
    </div>
  );
}

export async function OwnerOnly({ children }: { children: React.ReactNode }) {
  if (isOwner(await currentUser())) return <>{children}</>;
  return <p className="rounded-2xl border border-dashed border-line px-6 py-14 text-center text-muted">Esta sección es solo para el dueño de Creads.</p>;
}
