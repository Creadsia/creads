import { NextResponse } from "next/server";
import { SESSION_COOKIE, cookieOptions, createSession, findUserByEmail, verifyPassword } from "@/lib/auth";

const fail = async () => {
  await new Promise((r) => setTimeout(r, 900)); // slow down guessing
  return NextResponse.json({ error: "Correo o clave incorrectos." }, { status: 401 });
};

// POST {email, password} signs in and sets the session cookie (30 days).
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const email = typeof b?.email === "string" ? b.email : "";
  const password = typeof b?.password === "string" ? b.password : "";
  if (!email || !password) return fail();
  try {
    const user = await findUserByEmail(email);
    if (!user || !user.active || !(await verifyPassword(password, user.password_hash))) return fail();
    const token = await createSession(user.id, req.headers.get("user-agent") ?? "");
    const res = NextResponse.json({ ok: true, user: { email: user.email, name: user.name, role: user.role } });
    res.cookies.set(SESSION_COOKIE, token, cookieOptions);
    return res;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo entrar." }, { status: 502 });
  }
}
