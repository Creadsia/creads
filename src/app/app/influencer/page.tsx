import type { Metadata } from "next";
import { FullOnly } from "../_parts/full-only";
import Personajes from "./personajes";

export const metadata: Metadata = { title: "Influencer IA" };
export default function Page() {
  return <FullOnly><Personajes /></FullOnly>;
}
