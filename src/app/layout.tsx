import type { Metadata } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creads · Anuncios de video para lead-gen",
  description:
    "Pega tu guion ganador y recibe anuncios de video terminados para Meta: cortes, voz, subtítulos y revisión automática.",
  metadataBase: new URL("https://www.creadsia.com"),
  openGraph: {
    title: "Creads · Tu guion ganador, convertido en anuncios",
    description: "Anuncios de video para lead-gen en Meta, hechos con IA y revisados antes de entregártelos.",
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
