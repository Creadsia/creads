import { after, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { SESSION_COOKIE, cookieOptions, createSession, createUser, findUserByEmail, twoFactorOf, workspaceOpen } from "@/lib/auth";
import { clientIp, tooMany } from "@/lib/rate";
import { createClientWorkspace, removeWorkspace } from "@/lib/signup";
import { giveStarterAvatars } from "@/lib/avatares-creads";
import { sendMeta, visitorFrom } from "@/lib/meta";
import { saveOrigin } from "@/lib/leads";
import { sendEmail } from "@/lib/providers/email";
import { SITE, welcomeEmail } from "@/lib/emails";
import { regaloSign } from "@/lib/regalo";
import { STATE_COOKIE, googleOn, readIdToken, safeNext } from "@/lib/google-login";

export const dynamic = "force-dynamic";

// Google sends the person back here with a code: we swap it for their verified email, then sign them in
// (existing account) or create their account (new), and continue where they were going.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (aviso: string) => {
    const r = NextResponse.redirect(new URL(`/app?aviso=${aviso}`, url.origin));
    r.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
    return r;
  };
  if (!googleOn()) return back("google");
  const raw = (req.headers.get("cookie") ?? "").split(/;\s*/).find((c) => c.startsWith(`${STATE_COOKIE}=`))?.slice(STATE_COOKIE.length + 1) ?? "";
  let saved: { state?: string; next?: string } = {};
  try { saved = JSON.parse(decodeURIComponent(raw) || "{}"); } catch { saved = {}; }
  const code = url.searchParams.get("code");
  if (!code || !saved.state || url.searchParams.get("state") !== saved.state) return back("google-cancelado");

  const tok = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${url.origin}/api/auth/google/callback`, grant_type: "authorization_code" }),
    signal: AbortSignal.timeout(15_000),
  }).then((r) => r.json()).catch(() => null) as { id_token?: string } | null;
  const id = tok?.id_token ? readIdToken(tok.id_token, process.env.GOOGLE_CLIENT_ID!) : null;
  if (!id) return back("google-error");

  let user = await findUserByEmail(id.email).catch(() => null);
  let created = false;
  if (user) {
    // the owner's team and anyone with two-step verification sign in with their password (and code)
    if (!user.active) return back("google-error");
    if (user.workspace === "main" || (await twoFactorOf(user.id).catch(() => null))?.on) return back("google-clave");
    if (!(await workspaceOpen(user.workspace))) return back("pausada");
  } else {
    const limited = await tooMany("signup", clientIp(req));
    if (limited) return back("google-error");
    let ws = "";
    try {
      ws = await createClientWorkspace(id.name || id.email.split("@")[0]);
      // a random password nobody knows: they can set their own with «¿Olvidaste tu clave?»
      user = { ...(await createUser({ email: id.email, name: id.name ?? undefined, password: randomBytes(24).toString("base64url"), role: "member", workspace: ws })), password_hash: "" };
      created = true;
    } catch (e) {
      console.error("google signup", e instanceof Error ? e.message : e);
      if (ws) await removeWorkspace(ws).catch(() => null);
      return back("google-error");
    }
  }
  const token = await createSession(user.id, req.headers.get("user-agent") ?? "");
  const visitor = visitorFrom(req);
  if (created) {
    const ws = user.workspace;
    after(() => giveStarterAvatars(ws));
    await sendMeta({ name: "CompleteRegistration", eventId: `reg-${user.id}`, email: user.email }, visitor).catch(() => null);
    if (visitor.src || visitor.camp) await saveOrigin(ws, { src: visitor.src ?? null, camp: visitor.camp ?? null }).catch(() => null);
    await sendEmail(welcomeEmail(user.email, user.name ?? id.name ?? "", `${SITE}/api/regalo?u=${encodeURIComponent(user.id)}&s=${regaloSign(user.id)}`)).catch(() => null);
  } else if (!user.last_login) {
    await sendMeta({ name: "CompleteRegistration", eventId: `reg-${user.id}`, email: user.email }, visitor).catch(() => null);
  }
  const res = NextResponse.redirect(new URL(safeNext(saved.next), url.origin));
  res.cookies.set(SESSION_COOKIE, token, cookieOptions);
  res.cookies.delete({ name: STATE_COOKIE, path: "/api/auth/google" });
  return res;
}
