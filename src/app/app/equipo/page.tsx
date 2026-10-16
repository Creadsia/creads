import type { Metadata } from "next";
import Equipo from "./equipo";

export const metadata: Metadata = { title: "Equipo" };
export default function Page() {
  return <Equipo />;
}
