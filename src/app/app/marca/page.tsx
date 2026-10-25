import type { Metadata } from "next";
import KitMarca from "./marca";

export const metadata: Metadata = { title: "Kit de marca" };
export default function Page() {
  return <KitMarca />;
}
