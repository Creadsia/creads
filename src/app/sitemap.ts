import type { MetadataRoute } from "next";
import { tieneEntradas } from "@/lib/confianza-server";

// The public pages people should find on Google. /novedades and /roadmap only once they have entries.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://www.creadsia.com";
  const [novedades, roadmap] = await Promise.all([tieneEntradas("novedades").catch(() => false), tieneEntradas("roadmap").catch(() => false)]);
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    ...(novedades ? [{ url: `${base}/novedades`, changeFrequency: "weekly" as const, priority: 0.4 }] : []),
    ...(roadmap ? [{ url: `${base}/roadmap`, changeFrequency: "weekly" as const, priority: 0.3 }] : []),
    { url: `${base}/afiliados`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/afiliados/terminos`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${base}/terminos`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${base}/privacidad`, changeFrequency: "monthly", priority: 0.2 },
  ];
}
