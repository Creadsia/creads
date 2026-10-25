import { NextResponse, type NextRequest } from "next/server";

// Which money to show (owner, 24 Oct 2026): pesos for visitors in Chile, US$ for the rest. The country
// comes from Vercel's geo header and is kept in a readable cookie that the page reads before painting
// (src/app/layout.tsx). «?pais=us» or «?pais=cl» forces it (to check how the other side sees it).
const COOKIE = "creads_pais";
const REF_COOKIE = "creads_ref"; // same name as COOKIE_REF in src/lib/afiliados-calc.ts

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const forced = (req.nextUrl.searchParams.get("pais") ?? "").toUpperCase();
  const manual = req.cookies.get(`${COOKIE}_fijo`)?.value === "1";
  const geo = (req.headers.get("x-vercel-ip-country") ?? "").toUpperCase();
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" as const };
  if (/^[A-Z]{2}$/.test(forced)) {
    res.cookies.set(COOKIE, forced, opts);
    res.cookies.set(`${COOKIE}_fijo`, "1", opts);
  } else if (!manual && /^[A-Z]{2}$/.test(geo) && req.cookies.get(COOKIE)?.value !== geo) {
    res.cookies.set(COOKIE, geo, opts);
  }
  // Affiliate program (owner, 25 Oct 2026): «?ref=CODE» on any public page remembers the affiliate for 60 days,
  // last click wins. The sign-up reads it (and checks the code); the click itself is counted by visit-beacon.tsx.
  const ref = (req.nextUrl.searchParams.get("ref") ?? "").trim().toUpperCase();
  if (/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(ref) && !/^\/(admin|app)(\/|$)/.test(req.nextUrl.pathname)) {
    res.cookies.set(REF_COOKIE, ref, { path: "/", maxAge: 60 * 60 * 24 * 60, sameSite: "lax", httpOnly: true, secure: req.nextUrl.protocol === "https:" });
  }
  return res;
}

// pages only (no API, no files)
export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
