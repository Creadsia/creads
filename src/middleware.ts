import { NextResponse, type NextRequest } from "next/server";

// Which money to show (owner, 24 Oct 2026): pesos for visitors in Chile, US$ for the rest. The country
// comes from Vercel's geo header and is kept in a readable cookie that the page reads before painting
// (src/app/layout.tsx). «?pais=us» or «?pais=cl» forces it (to check how the other side sees it).
const COOKIE = "creads_pais";

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
  return res;
}

// pages only (no API, no files)
export const config = { matcher: ["/((?!api|_next|.*\\..*).*)"] };
