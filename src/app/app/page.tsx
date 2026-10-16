import type { Metadata } from "next";
import Home from "./_parts/home";

export const metadata: Metadata = { title: "Inicio" };

export default function AppHome() {
  return <Home />;
}
