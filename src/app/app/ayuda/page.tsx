import type { Metadata } from "next";
import { PageHead } from "../_parts/ui";
import HelpCenter from "./help-center";

export const metadata: Metadata = { title: "Centro de ayuda" };

export default function AyudaPage() {
  return (
    <>
      <PageHead title="Centro de ayuda" lead="Respuestas rápidas a lo que más nos preguntan. Si no está aquí, el Asistente Creads te responde al instante." />
      <HelpCenter />
    </>
  );
}
