import type { Metadata } from "next";
import { es } from "@/content/es";
import Venta from "./venta";
import { usdClpRate } from "@/lib/usd-clp";
import { contadoresReales, galeriaPublica, novedadesRecientes, roadmapPublico } from "@/lib/confianza-server";
import { testimoniosPublicados } from "@/lib/casos";
import { modoPack } from "@/lib/oferta";

export const revalidate = 300; // rebuilt every 5 minutes (the gallery and testimonials from the admin show up quickly)
export const dynamic = "force-static"; // served from cache: fast for every visitor

// Launching in Chile: the home page is in Spanish; English lives at /en.
export const metadata: Metadata = {
  title: es.meta.title,
  description: es.meta.description,
  alternates: { canonical: "/" },
  openGraph: { title: es.meta.title, description: es.meta.description, url: "/", locale: "es_CL" },
};

export default async function Home() {
  // the sales page for people who arrive from ads (the broad landing stays for the English site)
  // the trust blocks only show real data; any failure just hides them
  const [rate, galeria, contadores, testimonios, novedades, roadmap] = await Promise.all([
    usdClpRate().catch(() => 950), galeriaPublica(), contadoresReales(), testimoniosPublicados().catch(() => []), novedadesRecientes(3), roadmapPublico(),
  ]);
  return <Venta t={es} rate={rate} renews={process.env.MP_ONE_TIME !== "1"} confianza={{ galeria, contadores, testimonios, novedades, roadmap: roadmap.length > 0 }} pack={modoPack()} />;
}
