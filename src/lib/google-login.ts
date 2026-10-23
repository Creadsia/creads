// «Continuar con Google» (owner, 22 Oct 2026: more trust, less friction). Standard OAuth 2.0 / OpenID
// Connect code flow: Google confirms the person's email and Creads signs them in (or creates their account).
// Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel; without them the button doesn't show.
// The owner's account (Creadsia) and accounts with two-step verification keep using their password.

export const googleOn = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const STATE_COOKIE = "creads_g";

/** Where to go after signing in: only paths of this site. */
export function safeNext(v: unknown) {
  const s = typeof v === "string" ? v : "";
  return /^\/(?!\/)[\w\-./?=&%]*$/.test(s) ? s.slice(0, 200) : "/app";
}

export interface GoogleId { email: string; name: string | null; sub: string }

/** Reads the id_token Google returned to our server (over TLS, for our client secret): checks it's for us, fresh and the email verified. */
export function readIdToken(idToken: string, clientId: string, now = Date.now()): GoogleId | null {
  const part = idToken.split(".")[1];
  if (!part) return null;
  let p: Record<string, unknown>;
  try { p = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")); } catch { return null; }
  if (p.aud !== clientId) return null;
  if (p.iss !== "https://accounts.google.com" && p.iss !== "accounts.google.com") return null;
  if (typeof p.exp !== "number" || p.exp * 1000 < now - 60_000) return null;
  if (p.email_verified !== true || typeof p.email !== "string" || typeof p.sub !== "string") return null;
  return { email: p.email.toLowerCase(), name: typeof p.name === "string" ? p.name.slice(0, 60) : null, sub: p.sub };
}
