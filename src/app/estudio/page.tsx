import { redirect } from "next/navigation";

// The old single-page studio grew into the platform at /app.
export default function EstudioPage() {
  redirect("/app");
}
