import { NextResponse } from "next/server";
import { tokenFromCookieHeader, userFromToken } from "@/lib/auth";
import { checkRequest, issueCode, originOf } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// The «Autorizar» button of /app/conectar: only from Creads' own page, with the signed-in browser session
// (never an API key). Answers where to send the user back, with the one-time code.
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== originOf(req)) return NextResponse.json({ error: "Solicitud no permitida." }, { status: 403 });
  const user = await userFromToken(tokenFromCookieHeader(req.headers.get("cookie")));
  if (!user) return NextResponse.json({ error: "Tu sesión terminó. Vuelve a entrar." }, { status: 401 });
  const p = ((await req.json().catch(() => null)) ?? {}) as Record<string, string>;
  const ok = checkRequest(p);
  if (typeof ok === "string") return NextResponse.json({ error: ok }, { status: 400 });
  const back = new URL(p.redirect_uri);
  if (p.decision === "deny") {
    back.searchParams.set("error", "access_denied");
  } else {
    back.searchParams.set("code", await issueCode({ userId: user.id, clientId: p.client_id, redirectUri: p.redirect_uri, challenge: p.code_challenge }));
  }
  if (p.state) back.searchParams.set("state", p.state);
  back.searchParams.set("iss", originOf(req));
  return NextResponse.json({ redirect: back.toString() });
}
