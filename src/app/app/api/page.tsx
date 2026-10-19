import type { Metadata } from "next";
import ApiPage from "./api-page";

export const metadata: Metadata = { title: "API para sistemas" };
export default function Page() {
  return <ApiPage />;
}
