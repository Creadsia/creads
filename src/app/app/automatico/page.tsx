import type { Metadata } from "next";
import Link from "next/link";
import Asistente from "./asistente";
import { PageHead } from "../_parts/ui";

export const metadata: Metadata = { title: "Anuncio automático" };

export default function Page() {
  return (
    <>
      <PageHead title="Anuncio automático" lead="Conversa con Creads: te pregunta lo necesario, hace el anuncio, lo revisa y te lo entrega listo.">
        <Link href="/app/crear" className="text-sm font-semibold text-muted underline">Prefiero hacerlo paso a paso (Manual)</Link>
      </PageHead>
      <Asistente />
    </>
  );
}
