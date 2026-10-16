import type { Metadata } from "next";
import { countUsers } from "@/lib/auth";
import { currentUser } from "@/lib/admin";
import Login from "./_parts/login";
import Shell from "./_parts/shell";

export const metadata: Metadata = {
  title: { default: "Creads", template: "%s · Creads" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

// The customer platform: only signed-in accounts get in.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (user) {
    return (
      <div lang="es">
        <Shell user={{ email: user.email, name: user.name, role: user.role }}>{children}</Shell>
      </div>
    );
  }
  const n = await countUsers().catch(() => 1);
  return (
    <div lang="es">
      <Login mode={n === -1 ? "missing" : n === 0 ? "setup" : "login"} />
    </div>
  );
}
