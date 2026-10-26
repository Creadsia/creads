import type { Metadata } from "next";
import HooksBiblioteca from "./hooks";
import { PageHead } from "../_parts/ui";

export const metadata: Metadata = { title: "Hooks por rubro" };

export default function Page() {
  return (
    <>
      <PageHead title="Hooks por rubro" lead="Ideas de ganchos para tus anuncios, ordenadas por rubro y por ángulo de venta. Cópialas, cámbialas a tu manera o llévalas a tus anuncios." />
      <HooksBiblioteca />
    </>
  );
}
