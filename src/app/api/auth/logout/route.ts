import { NextResponse } from "next/server";
import { SESSION_COOKIE, cookieOptions, endSession, tokenFromCookieHeader } from "@/lib/auth";

export async function POST(req: Request) {
  await endSession(tokenFromCookieHeader(req.headers.get("cookie")));
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return res;
}
