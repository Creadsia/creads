import type { Metadata } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creads · Estudio de contenido con IA en español",
  description:
    "Crea anuncios, reels, podcasts y fotos de producto con IA, en español. Escribe la idea y recibe el contenido terminado.",
  metadataBase: new URL("https://www.creadsia.com"),
  openGraph: {
    title: "Creads · Escribe la idea. Recibe el contenido terminado.",
    description: "El estudio de contenido con IA en español: anuncios, reels, podcasts y fotos de producto.",
    url: "https://www.creadsia.com",
    siteName: "Creads",
    locale: "es_CL",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
