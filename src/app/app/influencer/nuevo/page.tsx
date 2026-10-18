import type { Metadata } from "next";
import { Suspense } from "react";
import { FullOnly } from "../../_parts/full-only";
import Creador from "./creador";

export const metadata: Metadata = { title: "Crear personaje" };
export default function Page() {
  return <FullOnly><Suspense fallback={<p className="text-muted">Cargando…</p>}><Creador /></Suspense></FullOnly>;
}
