import type { Metadata } from "next";
import VoiceLab from "../_parts/voice-lab";
import { PageHead } from "../_parts/ui";

export const metadata: Metadata = { title: "Voces" };

export default function VocesPage() {
  return (
    <>
      <PageHead title="Voces" lead="Clona la voz de tu presentador (con su permiso) o elige una de la biblioteca, y escucha cómo lee tu guion." />
      <VoiceLab code="session" />
    </>
  );
}
