import { cookies } from "next/headers";
import { SESSION_COOKIE, type User, isOwner, isTheOwner, twoFactorOf, userFromToken } from "./auth";

// Server-side helpers for pages: who is signed in, and whether they may open the owner's panel.

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

/** Who may open the Panel interno: the owner, or a partner with two-step verification turned on. */
export async function panelAccess(u: User | null): Promise<"ok" | "no" | "2fa"> {
  if (isTheOwner(u)) return "ok";
  if (!isOwner(u)) return "no";
  const tf = await twoFactorOf(u!.id).catch(() => undefined);
  return tf?.on ? "ok" : "2fa";
}

/** Finance, accounts and the office: the owner and partners with two-step verification. */
export async function isAdmin(): Promise<boolean> {
  return (await panelAccess(await currentUser())) === "ok";
}
