import type { Metadata } from "next";
import { FullOnly } from "../_parts/full-only";
import { NextStep, PageHead, Stepper } from "../_parts/ui";
import Spy from "./spy";

export const metadata: Metadata = { title: "Espiar anuncios" };

// Step 1 of a campaign: search the ads already selling in your niche and send the best to «Crear guion».
export default function SpyPage() {
  return (
    <>
      <Stepper flow="anuncio" current={0} />
      <PageHead title="Espiar anuncios" lead="Mira qué está funcionando en tu nicho antes de crear. Si alguien lleva semanas pagando un anuncio, ese anuncio vende: desármalo y haz tu versión." />
      <FullOnly>
        <Spy />
        <NextStep href="/app/guiones" title="Crea tu guion con el anuncio que encontraste" text="Toca «Desarmar este guion» en cualquier anuncio: lo llevamos a «Crear guion», donde la IA te explica por qué funciona y te da 3 ángulos o 10 hooks nuevos." />
      </FullOnly>
    </>
  );
}
