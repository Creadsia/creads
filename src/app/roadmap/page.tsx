import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Legal from "../legal";
import NovedadesLista from "../novedades-lista";
import { fechaLarga, roadmapPorEstado } from "@/lib/confianza";
import { roadmapPublico } from "@/lib/confianza-server";

// Public roadmap (in progress, planned, done), written by the owner in Panel → Marketing → Portada.
// No entries → 404 (never an empty page).
export const revalidate = 3600;
export const metadata: Metadata = { title: "Hoja de ruta · Creads IA", description: "En qué estamos trabajando en Creads IA, qué viene y qué ya está listo." };

export default async function Roadmap() {
  const entradas = await roadmapPublico();
  if (!entradas.length) notFound();
  return (
    <Legal title="Hoja de ruta" updated={fechaLarga(entradas[0].fecha)}>
      <p className="text-muted">En qué estamos trabajando, qué viene y qué ya está listo. Lo ya lanzado está en <a href="/novedades" className="underline">Novedades</a>.</p>
      {roadmapPorEstado(entradas).map((g) => (
        <section key={g.estado} aria-label={g.label} className="mt-4 flex flex-col gap-4">
          <h2>{g.label}</h2>
          <NovedadesLista entradas={g.entradas} />
        </section>
      ))}
    </Legal>
  );
}
