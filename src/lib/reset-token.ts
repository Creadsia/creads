import { createHmac, timingSafeEqual } from "node:crypto";

// "Forgot my password" links, with nothing stored: the link carries the email and an expiry, signed
// with a server secret and the account's current password hash. Changing the password (which the
// link does) changes the hash, so each link works once; it also expires after an hour.

const TTL_MS = 60 * 60 * 1000;

function key() {
  const base = process.env.RESET_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.");
  return createHmac("sha256", "creads-reset-v1").update(base).digest();
}

const sign = (email: string, exp: number, hash: string) => createHmac("sha256", key()).update(`${email}\n${exp}\n${hash}`).digest("base64url");

export function makeResetToken(email: string, passwordHash: string, now = Date.now()): string {
  const exp = now + TTL_MS;
  return `${Buffer.from(`${email}\n${exp}`).toString("base64url")}.${sign(email, exp, passwordHash)}`;
}

/** The email inside a well-formed, unexpired token (the signature is checked separately, with the hash). */
export function readResetToken(token: string, now = Date.now()): { email: string; exp: number; sig: string } | null {
  const [body, sig] = String(token).split(".");
  if (!body || !sig || token.length > 600) return null;
  const [email, expS] = Buffer.from(body, "base64url").toString("utf8").split("\n");
  const exp = Number(expS);
  if (!email || !Number.isFinite(exp) || exp < now) return null;
  return { email, exp, sig };
}

export function resetTokenOk(t: { email: string; exp: number; sig: string }, passwordHash: string): boolean {
  const want = Buffer.from(sign(t.email, t.exp, passwordHash));
  const got = Buffer.from(t.sig);
  return want.length === got.length && timingSafeEqual(want, got);
}
