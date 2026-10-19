import type { Metadata } from "next";
import ApiPage from "./api-page";

export const metadata: Metadata = { title: "API y conector" };
export default function Page() {
  return <ApiPage />;
}
