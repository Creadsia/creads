import { NextResponse } from "next/server";
import { clientIp, tooMany } from "@/lib/rate";
import { findUserByEmail, passwordProblem, updateUser } from "@/lib/auth";
import { readResetToken, resetTokenOk } from "@/lib/reset-token";

// POST {token, password}: sets the new password from an emailed link. Every open session is closed;
// the person then signs in (with two-step verification, if they have it on).
export async function POST(req: Request) {
  const limited = await tooMany("resetIp", clientIp(req));
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const bad = passwordProblem(String(b?.password ?? ""));
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  const expired = NextResponse.json({ error: "Este enlace ya se usó o venció. Pide uno nuevo desde «¿Olvidaste tu clave?»." }, { status: 400 });
  const t = readResetToken(String(b?.token ?? ""));
  if (!t) return expired;
  try {
    const user = await findUserByEmail(t.email);
    if (!user || user.active === false || !resetTokenOk(t, user.password_hash)) return expired;
    await updateUser(user.id, { password: String(b.password) });
    return NextResponse.json({ ok: true, email: user.email });
  } catch (err) {
    console.error("reset", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "No se pudo cambiar la clave. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
