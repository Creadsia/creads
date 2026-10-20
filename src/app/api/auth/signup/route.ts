import { after, NextResponse } from "next/server";
import { giveStarterAvatars } from "@/lib/avatares-creads";
import { SESSION_COOKIE, cookieOptions, createSession, createUser, deleteUser, findUserByEmail, normEmail, passwordProblem } from "@/lib/auth";
import { clientIp, tooMany } from "@/lib/rate";
import { createClientWorkspace, emailOk, removeWorkspace } from "@/lib/signup";
import { sendMeta, visitorFrom } from "@/lib/meta";
import { sendEmail } from "@/lib/providers/email";
import { welcomeEmail } from "@/lib/emails";

export const dynamic = "force-dynamic";

// POST {name, email, password, company?}: a visitor creates their own account from the
// website (/empezar) and is signed in right away. New accounts start with 0 credits, so nothing can
// be spent until they pay. Limited per connection to stop mass sign-ups.
export async function POST(req: Request) {
  const limited = await tooMany("signup", clientIp(req));
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const name = String(b?.name ?? "").trim().slice(0, 60);
  const company = String(b?.company ?? "").trim().slice(0, 80);
  const email = normEmail(String(b?.email ?? "").slice(0, 200));
  const password = typeof b?.password === "string" ? b.password.slice(0, 200) : "";
  if (name.length < 2) return NextResponse.json({ error: "Escribe tu nombre.", field: "name" }, { status: 400 });
  if (!emailOk(email)) return NextResponse.json({ error: "Revisa tu correo: parece que le falta algo.", field: "email" }, { status: 400 });
  const weak = passwordProblem(password);
  if (weak) return NextResponse.json({ error: weak, field: "password" }, { status: 400 });
  let ws = "";
  let userId = "";
  try {
    if (await findUserByEmail(email)) {
      return NextResponse.json({ error: "Ya tienes una cuenta con ese correo. Entra con tu clave para pagar.", field: "email", exists: true }, { status: 409 });
    }
    ws = await createClientWorkspace(company || name);
    const user = await createUser({ email, name, password, role: "member", workspace: ws });
    userId = user.id;
    const token = await createSession(user.id, req.headers.get("user-agent") ?? "");
    const newWs = user.workspace;
    after(() => giveStarterAvatars(newWs)); // six ready-made presenters, so the first ad needs no setup
    userId = ""; ws = ""; // from here on the account is complete: nothing to undo
    // same id the first sign-in would use, and the browser pixel gets it too: Meta counts it once
    const eventId = `reg-${user.id}`;
    await sendMeta({ name: "CompleteRegistration", eventId, email }, visitorFrom(req)).catch(() => null);
    await sendEmail(welcomeEmail(email, name)); // never fails the sign-up
    const res = NextResponse.json({ ok: true, eventId });
    res.cookies.set(SESSION_COOKIE, token, cookieOptions);
    return res;
  } catch (err) {
    // don't leave half an account behind (a user without a session, an empty workspace)
    if (userId) await deleteUser(userId).catch(() => null);
    if (ws) await removeWorkspace(ws);
    const dup = err instanceof Error && /duplicate|unique/i.test(err.message);
    if (dup) return NextResponse.json({ error: "Ya tienes una cuenta con ese correo. Entra con tu clave para pagar.", field: "email", exists: true }, { status: 409 });
    console.error("signup failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No pudimos crear tu cuenta. Intenta de nuevo en un momento o escríbenos a hola@creadsia.com." }, { status: 502 });
  }
}
