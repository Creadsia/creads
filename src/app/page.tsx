import type { Metadata } from "next";
import { en } from "@/content/en";
import Landing from "./landing";
import { usdClpRate } from "@/lib/usd-clp";

export const revalidate = 3600; // prices in pesos follow the dollar rate set in Finanzas

export const metadata: Metadata = {
  title: en.meta.title,
  description: en.meta.description,
  alternates: { canonical: "/", languages: { en: "/", es: "/es" } },
  openGraph: { title: en.meta.title, description: en.meta.description, url: "/", locale: "en_US" },
};

export default async function Home() {
  return <Landing t={en} rate={await usdClpRate().catch(() => 950)} />;
}
