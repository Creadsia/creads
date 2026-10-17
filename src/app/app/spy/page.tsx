import type { Metadata } from "next";
import { FullOnly } from "../_parts/full-only";
import { Empty, PageHead } from "../_parts/ui";

export const metadata: Metadata = { title: "Espiar anuncios" };

export default function SpyPage() {
  return (
    <>
      <PageHead title="Espiar anuncios" lead="Anuncios de afiliados que llevan semanas activos en tu nicho. Si alguien los sigue pagando, están funcionando." />
      <FullOnly><Empty title="Muy pronto" text="Estamos preparando la biblioteca de anuncios. Vas a poder buscar por nicho, guardar los mejores y crear tus versiones con un clic." /></FullOnly>
    </>
  );
}
