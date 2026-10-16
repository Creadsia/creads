import { cookies } from "next/headers";
import { SESSION_COOKIE, type User, userFromToken } from "./auth";

// Server-side helpers for pages: who is signed in, and whether they may open the owner's panel.

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

/** Finance and accounts are owner-only. */
export async function isAdmin(): Promise<boolean> {
  return (await currentUser())?.role === "owner";
}
