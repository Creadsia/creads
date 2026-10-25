import type { Metadata } from "next";
import Link from "next/link";
import Asistente from "./asistente";
import RegaloAviso from "./regalo-aviso";
import PruebaTarjeta from "./prueba-tarjeta";
import { PageHead } from "../_parts/ui";

export const metadata: Metadata = { title: "Anuncio automático" };

export default function Page() {
  return (
    <>
      {/* phones: the chat is the page (its own welcome says what it does) */}
      <div className="hidden sm:block">
        <PageHead title="Anuncio automático" lead="Conversa con Creads: te pregunta lo necesario, hace el anuncio, lo revisa y te lo entrega listo.">
          <Link href="/app/crear" className="text-sm font-semibold text-muted underline">Prefiero hacerlo paso a paso (Manual)</Link>
        </PageHead>
      </div>
      <PruebaTarjeta />
      <RegaloAviso />
      <Asistente />
    </>
  );
}
