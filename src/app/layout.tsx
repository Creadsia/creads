import type { Metadata } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/hanken-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creads · The AI content studio",
  description: "Create ads, reels, podcasts and product photos with the world's best AI models.",
  metadataBase: new URL("https://www.creadsia.com"),
  openGraph: { siteName: "Creads", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
