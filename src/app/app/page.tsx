import type { Metadata } from "next";
import { currentUser } from "@/lib/admin";
import { hasFullStudio } from "@/lib/auth";
import Home from "./_parts/home";

export const metadata: Metadata = { title: "Inicio" };

export default async function AppHome() {
  return <Home full={hasFullStudio(await currentUser())} />;
}
