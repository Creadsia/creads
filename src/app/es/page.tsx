import type { Metadata } from "next";
import { es } from "@/content/es";
import Landing from "../landing";
import { usdClpRate } from "@/lib/usd-clp";

export const revalidate = 3600; // prices in pesos follow the dollar rate set in Finanzas

export const metadata: Metadata = {
  title: es.meta.title,
  description: es.meta.description,
  alternates: { canonical: "/es", languages: { en: "/", es: "/es" } },
  openGraph: { title: es.meta.title, description: es.meta.description, url: "/es", locale: "es_CL" },
};

export default async function HomeEs() {
  const rate = await usdClpRate().catch(() => 950);
  return (
    <div lang="es">
      <Landing t={es} rate={rate} />
    </div>
  );
}
