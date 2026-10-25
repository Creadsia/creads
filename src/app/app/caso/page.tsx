import type { Metadata } from "next";
import Caso from "./caso";

export const metadata: Metadata = { title: "Cuéntanos cómo te fue" };
export default function Page() {
  return <Caso />;
}
