import type { Metadata } from "next";
import { cookies } from "next/headers";
import { hasAccessCookies } from "@/lib/access";
import Gate from "./_parts/gate";
import Shell from "./_parts/shell";

export const metadata: Metadata = {
  title: { default: "Creads", template: "%s · Creads" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

// The customer platform. Until accounts exist (Phase 2), an access code opens it.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const ok = hasAccessCookies((n) => jar.get(n)?.value);
  return <div lang="es">{ok ? <Shell>{children}</Shell> : <Gate />}</div>;
}
