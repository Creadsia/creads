import type { Metadata } from "next";
import ModelLab from "../_parts/model-lab";
import { PageHead } from "../_parts/ui";

export const metadata: Metadata = { title: "Probar modelos" };

export default function LabPage() {
  return (
    <>
      <PageHead title="Probar modelos" lead="Genera una imagen o un video suelto con cualquiera de los modelos conectados, para comparar calidad y precio." />
      <ModelLab code="session" />
    </>
  );
}
