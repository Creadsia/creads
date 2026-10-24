import type { Metadata } from "next";
import ModelLab from "../_parts/model-lab";
import { FullOnly } from "../_parts/full-only";
import { PageHead } from "../_parts/ui";

export const metadata: Metadata = { title: "Imágenes para anuncios" };

export default function LabPage() {
  return (
    <>
      <PageHead title="Imágenes para anuncios" lead="Describe tu anuncio o sube uno que ya funciona: Creads crea imágenes con ideas distintas. Usa 4:5 para el feed." />
      <FullOnly><ModelLab code="session" imagesOnly /></FullOnly>
    </>
  );
}
