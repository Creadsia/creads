import type { Metadata } from "next";
import PrimeraTanda from "./tanda";

export const metadata: Metadata = { title: "Tu primera tanda" };
export default function Page() {
  return <PrimeraTanda />;
}
