import type { Metadata } from "next";
import Avatares from "./avatares";

export const metadata: Metadata = { title: "Avatares" };
export default function Page() {
  return <Avatares />;
}
