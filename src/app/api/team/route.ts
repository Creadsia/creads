import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { type Role, canManageTeam, createUser, findUserByEmail, listUsers, userFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** A readable temporary password, shown once to whoever creates the account. */
const tempPassword = () => randomBytes(9).toString("base64url").replace(/[-_]/g, "x") + "-" + randomBytes(2).toString("hex");

export async function GET(req: Request) {
  const me = await userFromRequest(req);
  if (!canManageTeam(me)) return NextResponse.json({ error: "Solo el dueño o un administrador puede ver el equipo." }, { status: 403 });
  return NextResponse.json({ users: await listUsers(), me: me!.id });
}

// POST {email, name, role} creates an account with a temporary password (returned once).
export async function POST(req: Request) {
  const me = await userFromRequest(req);
  if (!canManageTeam(me)) return NextResponse.json({ error: "Solo el dueño o un administrador puede invitar." }, { status: 403 });
  const b = await req.json().catch(() => null);
  const email = String(b?.email ?? "").trim();
  const role: Role = b?.role === "admin" ? "admin" : "member";
  if (role === "admin" && me!.role !== "owner") return NextResponse.json({ error: "Solo el dueño puede crear administradores." }, { status: 403 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  if (await findUserByEmail(email)) return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
  const password = tempPassword();
  const user = await createUser({ email, name: String(b?.name ?? "").slice(0, 60), password, role, workspace: me!.workspace });
  return NextResponse.json({ user, password });
}
