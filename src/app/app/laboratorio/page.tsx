import type { Metadata } from "next";
import ModelLab from "../_parts/model-lab";
import { FullOnly } from "../_parts/full-only";
import { PageHead } from "../_parts/ui";

export const metadata: Metadata = { title: "Imágenes para anuncios" };

export default function LabPage() {
  return (
    <>
      <PageHead title="Imágenes para anuncios" lead="Describe tu anuncio y Creads crea varias imágenes con ideas distintas (otro gancho, otra escena), con la cara de tu avatar o tu producto si los subes. Usa 4:5 para el feed. El precio aparece antes de apretar." />
      <FullOnly><ModelLab code="session" imagesOnly /></FullOnly>
    </>
  );
}
