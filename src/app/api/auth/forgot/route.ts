import { NextResponse } from "next/server";
import { clientIp, tooMany } from "@/lib/rate";
import { findUserByEmail, normEmail } from "@/lib/auth";
import { emailOk } from "@/lib/signup";
import { makeResetToken } from "@/lib/reset-token";
import { SITE, resetEmail } from "@/lib/emails";
import { emailConfigured, sendEmail } from "@/lib/providers/email";

// POST {email}: emails a link to choose a new password. The answer is the same whether or not the
// account exists, so nobody can use it to find out who has an account.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const email = normEmail(String(b?.email ?? "")).slice(0, 200);
  if (!emailOk(email)) return NextResponse.json({ error: "Revisa tu correo: parece que le falta algo." }, { status: 400 });
  if (!emailConfigured()) return NextResponse.json({ error: "Por ahora escríbenos a hola@creadsia.com desde el correo de tu cuenta y te ayudamos." }, { status: 503 });
  const limited = (await tooMany("forgotIp", clientIp(req))) ?? (await tooMany("forgotEmail", email)) ?? (await tooMany("forgotAll", "all"));
  if (limited) return limited;
  const done = NextResponse.json({ ok: true });
  try {
    const user = await findUserByEmail(email);
    if (!user || user.active === false) {
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 400)); // about as long as a real send
      return done;
    }
    const link = `${SITE}/clave?t=${encodeURIComponent(makeResetToken(user.email, user.password_hash))}`;
    await sendEmail(resetEmail(user.email, user.name, link));
  } catch (err) {
    console.error("forgot", err instanceof Error ? err.message : err);
  }
  return done;
}
