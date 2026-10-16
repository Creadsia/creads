import type { Metadata } from "next";
import { FullOnly } from "../_parts/full-only";
import Aprendizajes from "./aprendizajes";

export const metadata: Metadata = { title: "Aprendizajes" };
export default function Page() {
  return <FullOnly><Aprendizajes /></FullOnly>;
}
