import { createHash, timingSafeEqual } from "node:crypto";

// Temporary gate for the platform until real login exists (Phase 2).
// A visitor unlocks it once with the access code set in Vercel (CREADS_ACCESS_CODE); the browser
// then keeps a hash of it in an http-only cookie. API routes also accept the code in the
// `x-creads-code` header, and the owner's admin cookie opens everything too.

export const ACCESS_COOKIE = "creads_access";
const ADMIN_COOKIE = "creads_admin";

const hash = (salt: string, code: string) => createHash("sha256").update(`${salt}:${code}`).digest("hex");
export const accessToken = (code: string) => hash("creads-access", code);

function same(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function cookieValue(cookieHeader: string | null, name: string) {
  const m = (cookieHeader ?? "").match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

/** True if the request carries a valid access cookie, header, or the admin cookie. */
export function hasAccess(req: Request): boolean {
  const code = process.env.CREADS_ACCESS_CODE;
  const admin = process.env.ADMIN_ACCESS_CODE;
  const cookies = req.headers.get("cookie");
  if (code) {
    const header = req.headers.get("x-creads-code") ?? "";
    if (header && same(header, code)) return true;
    const c = cookieValue(cookies, ACCESS_COOKIE);
    if (c && same(c, accessToken(code))) return true;
  }
  if (admin) {
    const a = cookieValue(cookies, ADMIN_COOKIE);
    if (a && same(a, hash("creads-admin", admin))) return true;
  }
  return false;
}

/** Returns an error message, or null when the request may proceed. */
export function checkAccess(req: Request): string | null {
  if (!process.env.CREADS_ACCESS_CODE && !process.env.ADMIN_ACCESS_CODE) return "Falta configurar CREADS_ACCESS_CODE en Vercel.";
  return hasAccess(req) ? null : "Código de acceso incorrecto.";
}

/** Same check for server components, from the incoming cookies. */
export function hasAccessCookies(get: (name: string) => string | undefined): boolean {
  const code = process.env.CREADS_ACCESS_CODE;
  const admin = process.env.ADMIN_ACCESS_CODE;
  const c = get(ACCESS_COOKIE) ?? "";
  const a = get(ADMIN_COOKIE) ?? "";
  if (code && c && same(c, accessToken(code))) return true;
  if (admin && a && same(a, hash("creads-admin", admin))) return true;
  return false;
}
