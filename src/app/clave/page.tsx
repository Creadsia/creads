import type { Metadata } from "next";
import { Suspense } from "react";
import NewPassword from "./new-password";

export const metadata: Metadata = { title: "Clave nueva · Creads IA", robots: { index: false } };

export default function Page() {
  return <Suspense><NewPassword /></Suspense>;
}
