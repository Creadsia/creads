import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creads · Anuncios de video para lead-gen",
  description:
    "Pega tu guion ganador y recibe anuncios de video terminados para Meta: cortes, voz, subtítulos y revisión automática.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
