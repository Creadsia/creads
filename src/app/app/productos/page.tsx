import type { Metadata } from "next";
import Productos from "./productos";

export const metadata: Metadata = { title: "Productos" };
export default function Page() {
  return <Productos />;
}
