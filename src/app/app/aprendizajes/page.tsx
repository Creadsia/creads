import type { Metadata } from "next";
import Aprendizajes from "./aprendizajes";

export const metadata: Metadata = { title: "Aprendizajes" };
export default function Page() {
  return <Aprendizajes />;
}
