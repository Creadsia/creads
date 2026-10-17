import type { Metadata } from "next";
import Crear from "./crear";
import { currentUser } from "@/lib/admin";
import { hasFullStudio } from "@/lib/auth";

export const metadata: Metadata = { title: "Crear anuncio" };
export default async function Page() {
  return <Crear full={hasFullStudio(await currentUser())} />;
}
