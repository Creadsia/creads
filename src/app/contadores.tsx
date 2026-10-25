import type { Contador } from "@/lib/confianza";

// Real counters of the home page (data from `contadoresReales()`, server, cached 1 h). Each number is rounded
// down and only comes when it passed its threshold (CONTADOR_MIN_ANUNCIOS / CONTADOR_MIN_MARCAS):
// an empty list renders nothing.
export default function Contadores({ datos, className = "" }: { datos: Contador[]; className?: string }) {
  if (!datos.length) return null;
  return (
    <dl aria-label="Creads en números" className={`flex flex-wrap items-stretch justify-center gap-3 sm:gap-4 ${className}`}>
      {datos.map((c) => (
        <div key={c.id} className="flex min-w-[10rem] flex-col items-center gap-1 rounded-2xl border border-line bg-surface px-5 py-4 text-center">
          <dt className="order-2 text-sm text-muted">{c.etiqueta}</dt>
          <dd className="order-1 bg-[image:var(--grad)] bg-clip-text font-display text-3xl font-semibold tabular-nums text-transparent sm:text-4xl">{c.texto}</dd>
        </div>
      ))}
    </dl>
  );
}
