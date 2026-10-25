import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/admin";
import { googleOn } from "@/lib/google-login";
import Registro from "./registro";
import { tarjetaObligatoria } from "@/lib/regalo";
import { cookies } from "next/headers";
import { COOKIE_REF, normCode } from "@/lib/afiliados-calc";

export const metadata: Metadata = {
  title: "Prueba Creads IA gratis",
  description: "Crea tu cuenta gratis: espía anuncios, crea guiones y recibe tu primer anuncio en video de regalo.",
  alternates: { canonical: "/registro" },
};
export const dynamic = "force-dynamic";

// Free sign-up, no card (owner, 23 Oct 2026, launch audit): try first, pay later.
export default async function Page() {
  const user = await currentUser().catch(() => null);
  if (user) redirect("/app/automatico");
  // the affiliate whose link they came through (60-day cookie), shown pre-filled; they can change or clear it
  const ref = normCode((await cookies()).get(COOKIE_REF)?.value);
  return <Registro google={googleOn()} tarjeta={tarjetaObligatoria()} refCode={ref} />;
}
