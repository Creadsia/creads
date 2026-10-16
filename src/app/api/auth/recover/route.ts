import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE, cookieOptions, createSession, listUsers, passwordProblem, updateUser } from "@/lib/auth";

// The owner forgot their password: proving access to Vercel (ADMIN_ACCESS_CODE) lets them set a new one.
// Only works for the owner account; team members ask the owner for a new password instead.
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const code = String(b?.code ?? "");
  const password = String(b?.password ?? "");
  const expected = process.env.ADMIN_ACCESS_CODE ?? "";
  if (!expected || code.length !== expected.length || !timingSafeEqual(Buffer.from(code), Buffer.from(expected))) {
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.json({ error: "La clave de administrador no coincide con la de Vercel." }, { status: 401 });
  }
  const bad = passwordProblem(password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  try {
    const owner = (await listUsers("main")).find((u) => u.role === "owner");
    if (!owner) return NextResponse.json({ error: "Todavía no hay cuenta de dueño. Recarga la página para crearla." }, { status: 404 });
    await updateUser(owner.id, { password, active: true });
    const res = NextResponse.json({ ok: true, email: owner.email });
    res.cookies.set(SESSION_COOKIE, await createSession(owner.id, req.headers.get("user-agent") ?? ""), cookieOptions);
    return res;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo cambiar la clave." }, { status: 502 });
  }
}
