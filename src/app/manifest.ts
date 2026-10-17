import type { MetadataRoute } from "next";

// Creads as an installable app (phone home screen, desktop): opens straight into the studio.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Creads IA",
    short_name: "Creads",
    description: "Anuncios en video con IA: guion, video, voz y subtítulos en un solo estudio.",
    lang: "es-CL",
    start_url: "/app?fuente=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    categories: ["business", "productivity", "photo"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Crear anuncio", url: "/app/crear", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Crear guion", url: "/app/guiones", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
