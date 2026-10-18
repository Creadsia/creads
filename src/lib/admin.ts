import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { SESSION_COOKIE, type User, isOwner, isTheOwner, twoFactorOf, userFromToken } from "./auth";

// Server-side helpers for pages: who is signed in, and whether they may open the owner's panel.

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

/**
 * Partners the owner let into the Panel WITHOUT two-step verification for a few days (his call, 18 Oct 2026),
 * by the SHA-256 of their email (no addresses in the code). Each one ends by itself on its date.
 */
const NO_2FA_UNTIL: Record<string, string> = { "58bcecc823168ecffc0738a2f5d393ea5a67063de3d9072e4a692ae0bc822cd0": "2026-11-18T23:59:59-03:00" };
const skips2fa = (u: User) => { const until = NO_2FA_UNTIL[createHash("sha256").update(u.email.trim().toLowerCase()).digest("hex")]; return Boolean(until && Date.now() < Date.parse(until)); };

/** Who may open the Panel interno: the owner, or a partner with two-step verification turned on. */
export async function panelAccess(u: User | null): Promise<"ok" | "no" | "2fa"> {
  if (isTheOwner(u)) return "ok";
  if (!isOwner(u)) return "no";
  if (skips2fa(u!)) return "ok";
  const tf = await twoFactorOf(u!.id).catch(() => undefined);
  return tf?.on ? "ok" : "2fa";
}

/** Finance, accounts and the office: the owner and partners with two-step verification. */
export async function isAdmin(): Promise<boolean> {
  return (await panelAccess(await currentUser())) === "ok";
}
