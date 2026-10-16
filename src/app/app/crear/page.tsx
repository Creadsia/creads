import type { Metadata } from "next";
import Crear from "./crear";

export const metadata: Metadata = { title: "Crear anuncio" };
export default function Page() {
  return <Crear />;
}
