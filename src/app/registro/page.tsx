import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/admin";
import { googleOn } from "@/lib/google-login";
import Registro from "./registro";

export const metadata: Metadata = {
  title: "Prueba Creads IA gratis",
  description: "Crea tu cuenta gratis, sin tarjeta: espía anuncios, crea guiones y recibe tu primer anuncio en video de regalo.",
  alternates: { canonical: "/registro" },
};
export const dynamic = "force-dynamic";

// Free sign-up, no card (owner, 23 Oct 2026, launch audit): try first, pay later.
export default async function Page() {
  const user = await currentUser().catch(() => null);
  if (user) redirect("/app/automatico");
  return <Registro google={googleOn()} />;
}
