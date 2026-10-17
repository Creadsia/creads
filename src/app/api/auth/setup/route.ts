import { NextResponse } from "next/server";
import { clientIp, tooMany } from "@/lib/rate";
import { timingSafeEqual } from "node:crypto";
import { publicError } from "@/lib/public-error";
import { SESSION_COOKIE, cookieOptions, countUsers, createSession, createUser, passwordProblem } from "@/lib/auth";

// First run only: creates the owner account. Requires the admin code from Vercel (ADMIN_ACCESS_CODE),
// so nobody else can claim the platform before the owner does. Once an account exists, this is closed.
export async function POST(req: Request) {
  const limited = await tooMany("recover", clientIp(req));
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const code = String(b?.code ?? "");
  const email = String(b?.email ?? "").trim();
  const password = String(b?.password ?? "");
  const expected = process.env.ADMIN_ACCESS_CODE ?? "";
  try {
    const n = await countUsers();
    if (n === -1) return NextResponse.json({ error: "Faltan las tablas de cuentas en Supabase (hay que ejecutar el SQL)." }, { status: 503 });
    if (n > 0) return NextResponse.json({ error: "La cuenta del dueño ya existe. Entra con tu correo y clave." }, { status: 409 });
    if (!expected || code.length !== expected.length || !timingSafeEqual(Buffer.from(code), Buffer.from(expected))) {
      await new Promise((r) => setTimeout(r, 900));
      return NextResponse.json({ error: "La clave de administrador no coincide con la de Vercel." }, { status: 401 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
    const bad = passwordProblem(password);
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });
    const user = await createUser({ email, name: String(b?.name ?? "").slice(0, 60), password, role: "owner" });
    const token = await createSession(user.id, req.headers.get("user-agent") ?? "");
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, cookieOptions);
    return res;
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo crear la cuenta.") }, { status: 502 });
  }
}
