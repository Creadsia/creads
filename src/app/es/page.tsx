import type { Metadata } from "next";
import { es } from "@/content/es";
import Landing from "../landing";

export const metadata: Metadata = {
  title: es.meta.title,
  description: es.meta.description,
  alternates: { canonical: "/es", languages: { en: "/", es: "/es" } },
  openGraph: { title: es.meta.title, description: es.meta.description, url: "/es", locale: "es_CL" },
};

export default function HomeEs() {
  return (
    <div lang="es">
      <Landing t={es} />
    </div>
  );
}
