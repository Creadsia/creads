import type { Metadata } from "next";
import Galeria from "./galeria";

export const metadata: Metadata = { title: "Galería de ideas" };
export default function Page() {
  return <Galeria />;
}
