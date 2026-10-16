import { NextResponse } from "next/server";
import { ACCESS_COOKIE, accessToken } from "@/lib/access";
import { timingSafeEqual } from "node:crypto";

// POST {code} unlocks the platform on this browser for 30 days. DELETE locks it again.
export async function POST(req: Request) {
  const expected = process.env.CREADS_ACCESS_CODE;
  if (!expected) return NextResponse.json({ error: "Falta configurar CREADS_ACCESS_CODE en Vercel." }, { status: 503 });
  const body = await req.json().catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const ok = code.length === expected.length && timingSafeEqual(Buffer.from(code), Buffer.from(expected));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 1000));
    return NextResponse.json({ error: "Código incorrecto." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, accessToken(expected), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}
