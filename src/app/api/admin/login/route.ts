import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminConfigured, adminLogin } from "@/lib/admin";

// POST {code} unlocks the panel for 30 days on this browser. DELETE locks it again.
export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ error: "Falta configurar ADMIN_ACCESS_CODE en Vercel." }, { status: 503 });
  }
  const body = await req.json().catch(() => null);
  const token = adminLogin(typeof body?.code === "string" ? body.code : "");
  if (!token) {
    await new Promise((r) => setTimeout(r, 1200)); // slow down guessing
    return NextResponse.json({ error: "Clave incorrecta." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 0 });
  return res;
}
