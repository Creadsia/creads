import type { Metadata } from "next";
import PrimeraTanda from "./tanda";
import { modoPack } from "@/lib/oferta";

export const metadata: Metadata = { title: "Anuncios desde tu producto" };
export default function Page() {
  // without balance: the Pack Prueba (MODO_PACK=1) or a plan (card trial: new accounts already have their gift)
  return <PrimeraTanda pack={modoPack()} />;
}
