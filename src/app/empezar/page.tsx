import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/admin";
import { PACKS, PLANS, type ItemId } from "@/lib/catalog";
import { usdClpRate } from "@/lib/usd-clp";
import Checkout from "./checkout";

export const metadata: Metadata = {
  title: "Empieza con Creads IA",
  description: "Elige tu plan, crea tu cuenta y paga con Mercado Pago. Primer mes con 50% de descuento.",
  robots: { index: false, follow: true },
};
export const dynamic = "force-dynamic";

// Checkout for new customers: plan → account → Mercado Pago, on one page.
// People who are already signed in go straight to their plans page with the same choice.
export default async function Empezar({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const want = String(sp.plan ?? "plus") as ItemId;
  const item: ItemId = [...PLANS, ...PACKS].some((x) => x.id === want) ? want : "plus";
  const period = sp.periodo === "anual" ? "anual" : "mensual";
  const user = await currentUser().catch(() => null);
  if (user) redirect(`/app/planes?plan=${item}&periodo=${period}`);
  const rate = await usdClpRate().catch(() => 950);
  return (
    <div lang="es">
      <Checkout item={item} period={period} rate={rate} />
    </div>
  );
}
