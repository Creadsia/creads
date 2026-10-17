import type { Metadata } from "next";
import Guiones from "./guiones";

export const metadata: Metadata = { title: "Crear guion" };
export default function Page() {
  return <Guiones />;
}
