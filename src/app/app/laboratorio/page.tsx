import type { Metadata } from "next";
import ModelLab from "../_parts/model-lab";
import { PageHead } from "../_parts/ui";

export const metadata: Metadata = { title: "Video e imagen IA" };

export default function LabPage() {
  return (
    <>
      <PageHead title="Video e imagen IA" lead="Genera una imagen o un clip suelto con cualquiera de los modelos: Veo, Kling, Seedance, Hailuo, Wan, Grok y Nano Banana. El precio aparece antes de apretar." />
      <ModelLab code="session" />
    </>
  );
}
