import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

// The owner's internal panel (/admin). Until real accounts exist, a single admin code set in Vercel
// (ADMIN_ACCESS_CODE) unlocks it. The browser only keeps a hash of it, in an http-only cookie.

export const ADMIN_COOKIE = "creads_admin";

const tokenFor = (code: string) => createHash("sha256").update(`creads-admin:${code}`).digest("hex");

function same(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export const adminConfigured = () => Boolean(process.env.ADMIN_ACCESS_CODE);

/** Returns the cookie value to set if the code is right, otherwise null. */
export function adminLogin(code: string): string | null {
  const expected = process.env.ADMIN_ACCESS_CODE;
  if (!expected || !code) return null;
  return same(code, expected) ? tokenFor(expected) : null;
}

export async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_ACCESS_CODE;
  if (!expected) return false;
  const got = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  return same(got, tokenFor(expected));
}
