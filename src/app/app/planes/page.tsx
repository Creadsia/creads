import type { Metadata } from "next";
import Planes from "./planes";

export const metadata: Metadata = { title: "Planes" };
export default function Page() {
  return <Planes />;
}
