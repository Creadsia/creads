import type { Metadata } from "next";
import { Empty, PageHead } from "../_parts/ui";

export const metadata: Metadata = { title: "Spy anuncios" };

export default function SpyPage() {
  return (
    <>
      <PageHead title="Spy anuncios" lead="Anuncios de afiliados que llevan semanas activos en tu nicho. Si alguien los sigue pagando, están funcionando." />
      <Empty title="Muy pronto" text="Estamos conectando la biblioteca de anuncios (Foreplay). Vas a poder buscar por nicho, guardar los mejores y crear tus versiones con un clic." />
    </>
  );
}
