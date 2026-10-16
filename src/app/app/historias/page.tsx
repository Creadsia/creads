import type { Metadata } from "next";
import Historias from "./historias";

export const metadata: Metadata = { title: "Historias animadas" };
export default function Page() {
  return <Historias />;
}
