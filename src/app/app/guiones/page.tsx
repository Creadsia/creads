import type { Metadata } from "next";
import Guiones from "./guiones";

export const metadata: Metadata = { title: "Generador de guiones" };
export default function Page() {
  return <Guiones />;
}
