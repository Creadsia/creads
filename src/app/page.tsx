import type { Metadata } from "next";
import { es } from "@/content/es";
import Venta from "./venta";
import { usdClpRate } from "@/lib/usd-clp";

export const revalidate = 3600; // rebuilt hourly (the approximate pesos follow the dollar)
export const dynamic = "force-static"; // served from cache: fast for every visitor

// Launching in Chile: the home page is in Spanish; English lives at /en.
export const metadata: Metadata = {
  title: es.meta.title,
  description: es.meta.description,
  alternates: { canonical: "/", languages: { "es-CL": "/", en: "/en" } },
  openGraph: { title: es.meta.title, description: es.meta.description, url: "/", locale: "es_CL" },
};

export default async function Home() {
  // the sales page for people who arrive from ads (the broad landing stays for the English site)
  return <Venta t={es} rate={await usdClpRate().catch(() => 950)} renews={process.env.MP_ONE_TIME !== "1"} />;
}
