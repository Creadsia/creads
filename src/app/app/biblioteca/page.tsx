import type { Metadata } from "next";
import Ads from "../_parts/ads";

export const metadata: Metadata = { title: "Anuncios terminados" };
export default function Page() {
  return <Ads mode="done" />;
}
