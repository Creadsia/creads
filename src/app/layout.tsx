import type { Metadata, Viewport } from "next";
import "@fontsource-variable/unbounded";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./globals.css";
import MetaPixel from "./meta-pixel";
import PostHog from "./posthog";
import { PwaSetup } from "./install-app";
import ErrorCatcher from "./error-catcher";
import EnvBanner from "./env-banner";
import VisitBeacon from "./visit-beacon";

export const metadata: Metadata = {
  title: "Creads IA · Anuncios en video que venden, sin grabar a nadie",
  description: "Anuncios UGC en video e imágenes para tu negocio, hechos con IA: guion, persona, voz con acento latino, edición y revisión. Planes desde US$29 al mes.",
  metadataBase: new URL("https://www.creadsia.com"),
  openGraph: { siteName: "Creads", type: "website" },
  // installable app: home-screen icon and full screen on iPhone
  appleWebApp: { capable: true, title: "Creads", statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = { themeColor: "#000000" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-CL" suppressHydrationWarning>
      <head>
        {/* Apply the saved light/dark choice and the visitor's money (pesos in Chile) before the first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("creads-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}try{if(/(?:^|; )creads_pais=CL(?:;|$)/.test(document.cookie))document.documentElement.setAttribute("data-cl","")}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        {children}
        <MetaPixel />
        <PostHog />
        <PwaSetup />
        <ErrorCatcher />
        <EnvBanner />
        <VisitBeacon />
      </body>
    </html>
  );
}
