import type { Metadata } from "next";
import VoiceLab from "../_parts/voice-lab";
import { NextStep, PageHead, Stepper } from "../_parts/ui";

export const metadata: Metadata = { title: "Voces" };

export default function VocesPage() {
  return (
    <>
      <Stepper flow="marca" current={0} />
      <PageHead title="Voces" lead="Primero la voz: clona la de tu presentador (con su permiso) o elige una de la biblioteca. Después la asignas a tu avatar." />
      <VoiceLab code="session" />
      <NextStep href="/app/avatares" title="Crea tu avatar" text="Sube la foto de la cara y elige la voz que acabas de crear." />
    </>
  );
}
