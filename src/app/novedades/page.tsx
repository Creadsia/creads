import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Legal from "../legal";
import NovedadesLista from "../novedades-lista";
import { fechaLarga } from "@/lib/confianza";
import { todasLasNovedades } from "@/lib/confianza-server";

// Public changelog, written by the owner in Panel → Marketing → Portada. No entries → 404 (never an empty page).
export const revalidate = 3600;
export const metadata: Metadata = { title: "Novedades · Creads IA", description: "Lo nuevo en Creads IA: modelos, funciones y mejoras, con su fecha." };

export default async function Novedades() {
  const entradas = await todasLasNovedades();
  if (!entradas.length) notFound();
  return (
    <Legal title="Novedades" updated={fechaLarga(entradas[0].fecha)}>
      <p className="text-muted">Lo que fuimos agregando y mejorando en Creads. ¿Quieres ver lo que viene? Mira la <a href="/roadmap" className="underline">hoja de ruta</a>.</p>
      <NovedadesLista entradas={entradas} className="mt-4" />
    </Legal>
  );
}
