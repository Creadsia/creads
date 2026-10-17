import type { Metadata } from "next";
import Ads from "../_parts/ads";

export const metadata: Metadata = { title: "En producción" };
export default function Page() {
  return <Ads mode="work" />;
}
