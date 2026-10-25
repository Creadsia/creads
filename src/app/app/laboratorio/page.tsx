import type { Metadata } from "next";
import ModelLab from "../_parts/model-lab";
import ControlImagen from "../_parts/control-imagen";
import { FullOnly } from "../_parts/full-only";
import { PageHead } from "../_parts/ui";

export const metadata: Metadata = { title: "Imágenes para anuncios" };

export default function LabPage() {
  return (
    <>
      <PageHead title="Imágenes para anuncios" lead="Elige el titular, el estilo y la escena, mira una vista previa barata y apruébala: Creads hace el feed 4:5, historias 9:16 y cuadrada 1:1 con tu texto exacto." />
      <FullOnly>
        <div className="flex flex-col gap-4">
          <ControlImagen />
          {/* the free-form studio (several ideas at once, iterate a winner) stays as it was */}
          <details className="rounded-2xl border border-line px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold">Modo libre: describe la imagen, varias ideas a la vez o itera un anuncio ganador</summary>
            <div className="mt-3"><ModelLab code="session" imagesOnly /></div>
          </details>
        </div>
      </FullOnly>
    </>
  );
}
