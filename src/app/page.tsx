import type { Metadata } from "next";
import { es } from "@/content/es";
import Landing from "./landing";
import { usdClpRate } from "@/lib/usd-clp";

export const revalidate = 3600; // prices in pesos follow the dollar rate set in Finanzas

// Launching in Chile: the home page is in Spanish; English lives at /en.
export const metadata: Metadata = {
  title: es.meta.title,
  description: es.meta.description,
  alternates: { canonical: "/", languages: { "es-CL": "/", en: "/en" } },
  openGraph: { title: es.meta.title, description: es.meta.description, url: "/", locale: "es_CL" },
};

export default async function Home() {
  return <Landing t={es} rate={await usdClpRate().catch(() => 950)} renews={process.env.MP_ONE_TIME !== "1"} />;
}
