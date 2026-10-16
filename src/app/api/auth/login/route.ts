import { NextResponse } from "next/server";
import { SESSION_COOKIE, cookieOptions, createSession, findUserByEmail, normEmail, twoFactorOf, verifyPassword, workspaceOpen } from "@/lib/auth";
import { clientIp, tooMany } from "@/lib/rate";
import { verifyCode } from "@/lib/totp";
import { sendMeta, visitorFrom } from "@/lib/meta";

// a valid scrypt hash of a random string: used when the email has no account
const DUMMY_HASH = "scrypt$8b3f0c0e8f6b4f7c2d1a9e5b7c3d2f10$" + "a1".repeat(64);

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
  const ip = clientIp(req);
  const limited = (await tooMany("loginIp", ip)) ?? (await tooMany("loginEmail", `${normEmail(email)}|${ip}`)) ?? (await tooMany("loginAccount", normEmail(email)));
  if (limited) return limited;
  try {
    const user = await findUserByEmail(email);
    // check a password even when the account doesn't exist, so the answer takes the same time
    const ok = await verifyPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !user.active || !ok) return fail();
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
    // first time in: Meta "CompleteRegistration" (customers only)
    if (!user.last_login && user.workspace !== "main") await sendMeta({ name: "CompleteRegistration", eventId: `reg-${user.id}`, email: user.email }, visitorFrom(req));
    const res = NextResponse.json({ ok: true, user: { email: user.email, name: user.name, role: user.role } });
    res.cookies.set(SESSION_COOKIE, token, cookieOptions);
    return res;
  } catch {
    return NextResponse.json({ error: "No se pudo entrar. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
