import type { Metadata } from "next";
import { en } from "@/content/en";
import Landing from "../landing";
import { usdClpRate } from "@/lib/usd-clp";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: en.meta.title,
  description: en.meta.description,
  alternates: { canonical: "/en", languages: { "es-CL": "/", en: "/en" } },
  openGraph: { title: en.meta.title, description: en.meta.description, url: "/en", locale: "en_US" },
};

export default async function HomeEn() {
  const rate = await usdClpRate().catch(() => 950);
  return (
    <div lang="en">
      <Landing t={en} rate={rate} renews={process.env.MP_ONE_TIME !== "1"} />
    </div>
  );
}
