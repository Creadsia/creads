import { NextResponse } from "next/server";
import { SESSION_COOKIE, cookieOptions, createSession, findUserByEmail, passwordProblem, updateUser, userFromRequest, verifyPassword } from "@/lib/auth";

// POST {current, next} changes your own password. Other sessions are closed; this one stays open.
export async function POST(req: Request) {
  const me = await userFromRequest(req);
  if (!me) return NextResponse.json({ error: "Tu sesión terminó. Vuelve a entrar." }, { status: 401 });
  const b = await req.json().catch(() => null);
  const full = await findUserByEmail(me.email);
  if (!full || !(await verifyPassword(String(b?.current ?? ""), full.password_hash))) {
    return NextResponse.json({ error: "La clave actual no es correcta." }, { status: 400 });
  }
  const bad = passwordProblem(String(b?.next ?? ""));
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  await updateUser(me.id, { password: String(b.next) });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(me.id, req.headers.get("user-agent") ?? ""), cookieOptions);
  return res;
}
