import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/admin";
import { ANNUAL, SHOWN_PLANS, type ItemId } from "@/lib/catalog";
import { usdClpRate } from "@/lib/usd-clp";
import Checkout from "./checkout";
import WhatsAppButton from "../whatsapp";
import { oneTimeOnly } from "@/lib/mercadopago";
import { googleOn } from "@/lib/google-login";
import { mpReady } from "@/lib/mercadopago";
import { tarjetaObligatoria } from "@/lib/regalo";
import { PRUEBA_DIAS, REGALO_CREDITS } from "@/lib/oferta";

export const metadata: Metadata = {
  title: "Empieza con Creads IA",
  description: "Elige tu plan y pruébalo 7 días gratis. Después, desde US$29 al mes. Cancelas cuando quieras.",
  robots: { index: false, follow: true },
};
export const dynamic = "force-dynamic";

// Checkout for new customers: plan → account → Mercado Pago, on one page.
// People who are already signed in go straight to their plans page with the same choice.
export default async function Empezar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const want = String(sp.plan ?? "escala") as ItemId;
  // new accounts start with a plan (top-ups are added to an active plan, from «Planes y créditos»)
  // only plans on sale: an old link to Ultra or to the annual payment opens Negocio, monthly
  const item: ItemId = SHOWN_PLANS.some((x) => x.id === want) ? want : "escala";
  const period = ANNUAL && sp.periodo === "anual" ? "anual" : "mensual";
  const user = await currentUser().catch(() => null);
  if (user) redirect(`/app/planes?plan=${item}&periodo=${period}`);
  const rate = await usdClpRate().catch(() => 950);
  return (
    <div lang="es">
      <Checkout item={item} period={period} rate={rate} renews={!oneTimeOnly()} google={googleOn()} prueba={tarjetaObligatoria() && mpReady() && !oneTimeOnly() ? { dias: PRUEBA_DIAS, regalo: REGALO_CREDITS } : null} />
      <WhatsAppButton text="Hola, tengo una pregunta antes de comprar Creads IA" />
    </div>
  );
}
