import type { Metadata } from "next";
import Tools from "../_parts/tools-hub";
import { FullOnly } from "../_parts/full-only";
import { PageHead } from "../_parts/ui";

export const metadata: Metadata = { title: "Herramientas IA" };

export default function ToolsPage() {
  return (
    <>
      <PageHead title="Herramientas IA" lead="Todo lo que necesitas para producir, en un clic: genera, edita, recorta, mejora, haz hablar una foto o dobla un video." />
      <FullOnly><Tools /></FullOnly>
    </>
  );
}
