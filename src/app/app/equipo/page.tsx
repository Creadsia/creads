import type { Metadata } from "next";
import { OwnerOnly } from "../_parts/full-only";
import Equipo from "./equipo";

export const metadata: Metadata = { title: "Equipo" };
export default function Page() {
  return <OwnerOnly><Equipo /></OwnerOnly>;
}
