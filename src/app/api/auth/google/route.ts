import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { STATE_COOKIE, googleOn, safeNext } from "@/lib/google-login";

export const dynamic = "force-dynamic";

// GET ?next=/app/planes?plan=plus → sends the person to Google to choose their account.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!googleOn()) return NextResponse.redirect(new URL("/app?aviso=google", url.origin));
  const state = randomBytes(18).toString("base64url");
  const next = safeNext(url.searchParams.get("next"));
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: `${url.origin}/api/auth/google/callback`, response_type: "code",
    scope: "openid email profile", state, prompt: "select_account",
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
  res.cookies.set(STATE_COOKIE, JSON.stringify({ state, next }), { httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
  return res;
}
