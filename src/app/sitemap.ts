import type { MetadataRoute } from "next";

// The public pages people should find on Google.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.creadsia.com";
  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/afiliados`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/afiliados/terminos`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${base}/terminos`, changeFrequency: "monthly", priority: 0.2 },
    { url: `${base}/privacidad`, changeFrequency: "monthly", priority: 0.2 },
  ];
}
