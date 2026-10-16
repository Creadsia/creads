import type { Metadata } from "next";
import Cuenta from "./cuenta";

export const metadata: Metadata = { title: "Mi cuenta" };
export default function Page() {
  return <Cuenta />;
}
