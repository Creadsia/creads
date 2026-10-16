import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { SESSION_COOKIE, cookieOptions, createSession, listUsers, passwordProblem, updateUser } from "@/lib/auth";

// One-time rescue link for the owner, valid for a few hours. Only the SHA-256 of the token is here.
// To be removed once the owner is back in.
const TOKEN_SHA256 = "df0a73f3b8f39170d1a6ecd8c0c22586fb1c79a71b9bdd9aace6c3164733f628";
const EXPIRES = "2026-10-16T04:41:28Z";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const token = String(b?.token ?? "");
  const password = String(b?.password ?? "");
  const got = Buffer.from(createHash("sha256").update(token).digest("hex"));
  const ok = Date.now() < Date.parse(EXPIRES) && got.length === TOKEN_SHA256.length && timingSafeEqual(got, Buffer.from(TOKEN_SHA256));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 1200));
    return NextResponse.json({ error: "Este enlace de rescate no es válido o ya venció." }, { status: 401 });
  }
  const bad = passwordProblem(password);
  if (bad) return NextResponse.json({ error: bad }, { status: 400 });
  const owner = (await listUsers()).find((u) => u.role === "owner");
  if (!owner) return NextResponse.json({ error: "No hay cuenta de dueño todavía." }, { status: 404 });
  await updateUser(owner.id, { password, active: true });
  const res = NextResponse.json({ ok: true, email: owner.email });
  res.cookies.set(SESSION_COOKIE, await createSession(owner.id, req.headers.get("user-agent") ?? ""), cookieOptions);
  return res;
}
