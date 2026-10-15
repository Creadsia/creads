import type { Metadata } from "next";
import { en } from "@/content/en";
import Landing from "./landing";

export const metadata: Metadata = {
  title: en.meta.title,
  description: en.meta.description,
  alternates: { canonical: "/", languages: { en: "/", es: "/es" } },
  openGraph: { title: en.meta.title, description: en.meta.description, url: "/", locale: "en_US" },
};

export default function Home() {
  return <Landing t={en} />;
}
