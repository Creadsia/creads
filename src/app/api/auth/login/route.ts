import { NextResponse } from "next/server";
import { SESSION_COOKIE, cookieOptions, createSession, findUserByEmail, normEmail, twoFactorOf, verifyPassword, workspaceOpen } from "@/lib/auth";
import { clientIp, tooMany } from "@/lib/rate";
import { verifyCode } from "@/lib/totp";

const fail = async () => {
  await new Promise((r) => setTimeout(r, 900)); // slow down guessing
  return NextResponse.json({ error: "Correo o clave incorrectos." }, { status: 401 });
};

// POST {email, password, code?} signs in and sets the session cookie (30 days).
// Limited per account and per connection; accounts with two-step verification also need the code.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const email = typeof b?.email === "string" ? b.email.slice(0, 200) : "";
  const password = typeof b?.password === "string" ? b.password.slice(0, 200) : "";
  if (!email || !password) return fail();
  const limited = (await tooMany("loginIp", clientIp(req))) ?? (await tooMany("loginEmail", normEmail(email)));
  if (limited) return limited;
  try {
    const user = await findUserByEmail(email);
    if (!user || !user.active || !(await verifyPassword(password, user.password_hash))) return fail();
    if (!(await workspaceOpen(user.workspace))) return NextResponse.json({ error: "Esta cuenta está pausada. Escríbenos a hola@creadsia.com." }, { status: 403 });
    const tf = await twoFactorOf(user.id);
    if (tf?.on && tf.secret) {
      const code = typeof b?.code === "string" ? b.code : "";
      if (!code) return NextResponse.json({ need2fa: true, error: "Escribe el código de 6 dígitos de tu app de verificación." }, { status: 401 });
      const tooManyCodes = await tooMany("twoFactor", user.id);
      if (tooManyCodes) return tooManyCodes;
      if (!verifyCode(tf.secret, code)) {
        await new Promise((r) => setTimeout(r, 700));
        return NextResponse.json({ need2fa: true, error: "Código incorrecto. Revisa que la hora de tu teléfono esté bien." }, { status: 401 });
      }
    }
    const token = await createSession(user.id, req.headers.get("user-agent") ?? "");
    const res = NextResponse.json({ ok: true, user: { email: user.email, name: user.name, role: user.role } });
    res.cookies.set(SESSION_COOKIE, token, cookieOptions);
    return res;
  } catch {
    return NextResponse.json({ error: "No se pudo entrar. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
