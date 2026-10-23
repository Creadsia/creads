import type { Metadata } from "next";
import { countUsers } from "@/lib/auth";
import { currentUser } from "@/lib/admin";
import { isOwner } from "@/lib/auth";
import Login from "./_parts/login";
import Shell from "./_parts/shell";
import { PostHogIdentify } from "../posthog";
import { googleOn } from "@/lib/google-login";

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
        <PostHogIdentify id={user.id} email={user.email} name={user.name} interno={user.workspace === "main"} />
        <Shell user={{ email: user.email, name: user.name, role: user.role, owner: isOwner(user), access: user.access ?? "full" }}>{children}</Shell>
      </div>
    );
  }
  const n = await countUsers().catch(() => 1);
  return (
    <div lang="es">
      <Login mode={n === -1 ? "missing" : n === 0 ? "setup" : "login"} google={googleOn()} />
    </div>
  );
}
