import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/admin";
import { googleOn } from "@/lib/google-login";
import Registro from "./registro";
import { tarjetaObligatoria } from "@/lib/regalo";
import { resumenPrueba } from "@/lib/prueba";
import { cookies } from "next/headers";
import { COOKIE_REF, normCode } from "@/lib/afiliados-calc";

export const metadata: Metadata = {
  title: "Prueba Creads IA 7 días gratis",
  description: "Crea tu cuenta, agrega tu tarjeta (hoy no se cobra nada) y recibe 200 créditos de regalo para tus primeros anuncios. Cancelas cuando quieras.",
  alternates: { canonical: "/registro" },
};
export const dynamic = "force-dynamic";

// Sign-up (owner, 26 Oct 2026): the account, then the card for the 7-day free trial (nothing charged today, gift
// credits, then the Testea plan unless cancelled). The studio stays locked until the card is added (trial-popup).
export default async function Page() {
  const user = await currentUser().catch(() => null);
  if (user) redirect("/app/automatico");
  // the affiliate whose link they came through (60-day cookie), shown pre-filled; they can change or clear it
  const ref = normCode((await cookies()).get(COOKIE_REF)?.value);
  return <Registro google={googleOn()} tarjeta={tarjetaObligatoria()} prueba={resumenPrueba()} refCode={ref} />;
}
