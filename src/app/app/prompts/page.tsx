import type { Metadata } from "next";
import Generador from "./generador";
import { PageHead } from "../_parts/ui";

export const metadata: Metadata = { title: "Generador de prompts" };

export default function Page() {
  return (
    <>
      <PageHead title="Generador de prompts" lead="Llena lo básico de tu negocio y Creads te escribe el pedido perfecto, con todo lo que hace que un anuncio salga bien a la primera. Úsalo en Automático o en Manual." />
      <Generador />
    </>
  );
}
