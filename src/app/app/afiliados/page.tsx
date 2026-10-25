import type { Metadata } from "next";
import Afiliados from "./afiliados";

export const metadata: Metadata = { title: "Programa de afiliados" };
export default function Page() {
  return <Afiliados />;
}
