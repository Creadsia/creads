import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { currentUser, isAdmin } from "@/lib/admin";
import { createUser, deleteUser, findUserByEmail, getUserIn, isTheOwner, listUsers, moveUser, updateUser } from "@/lib/auth";
import { WORKSPACE_RE } from "@/lib/db";

export const dynamic = "force-dynamic";

// People inside a customer's workspace, managed only by Creadsia's owner.
// POST {workspace, email, name?} adds someone (temporary password returned once).
// PATCH {workspace, id, active?, resetPassword?} pauses/resumes them or gives a new temporary password.
// PATCH {workspace, id, toTeam: true} brings a one-person customer account into Creadsia's team as a
//   partner (same email and password). Only Creadsia's owner; the old workspace stays, empty.
// DELETE ?workspace=…&id=… removes them.
// Creadsia's own workspace ("main") is managed in the studio's "Equipo" page, never from here.

const tempPassword = () => randomBytes(9).toString("base64url").replace(/[-_]/g, "x") + "-" + randomBytes(2).toString("hex");
const clientWs = (v: unknown): v is string => typeof v === "string" && WORKSPACE_RE.test(v) && v !== "main";
const deny = () => NextResponse.json({ error: "No autorizado." }, { status: 401 });

export async function POST(req: Request) {
  if (!(await isAdmin())) return deny();
  const b = await req.json().catch(() => null);
  const email = String(b?.email ?? "").trim();
  if (!clientWs(b?.workspace)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  try {
    if (await findUserByEmail(email)) return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
    const password = tempPassword();
    const user = await createUser({ email, name: String(b?.name ?? "").slice(0, 60), password, role: "member", workspace: b.workspace });
    return NextResponse.json({ user, password });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo crear." }, { status: 502 });
  }
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return deny();
  const b = await req.json().catch(() => null);
  if (!clientWs(b?.workspace)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  try {
    const target = await getUserIn(b.workspace, String(b?.id ?? ""));
    if (b?.toTeam === true) {
      if (!isTheOwner(await currentUser())) return NextResponse.json({ error: "Solo el dueño puede sumar socios." }, { status: 403 });
      if (!target) return NextResponse.json({ error: "Persona no encontrada." }, { status: 404 });
      const others = (await listUsers(b.workspace)).filter((u) => u.id !== target.id);
      if (others.length) return NextResponse.json({ error: "Esta cuenta tiene más personas: primero quítalas, para no dejarlas sin dueño." }, { status: 409 });
      await moveUser(target.id, "main");
      const user = await updateUser(target.id, { role: "admin" });
      return NextResponse.json({ user, moved: true });
    }
    if (!target || target.role === "owner") return NextResponse.json({ error: "Persona no encontrada." }, { status: 404 });
    const patch: Parameters<typeof updateUser>[1] = {};
    if (typeof b?.active === "boolean") patch.active = b.active;
    let password: string | undefined;
    if (b?.resetPassword) { password = tempPassword(); patch.password = password; }
    if (!Object.keys(patch).length) return NextResponse.json({ error: "Nada que cambiar." }, { status: 400 });
    const user = await updateUser(target.id, patch);
    return NextResponse.json({ user, password });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo cambiar." }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return deny();
  const q = new URL(req.url).searchParams;
  const ws = q.get("workspace");
  if (!clientWs(ws)) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  try {
    const target = await getUserIn(ws, q.get("id") ?? "");
    if (!target || target.role === "owner") return NextResponse.json({ error: "Persona no encontrada." }, { status: 404 });
    await deleteUser(target.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo borrar." }, { status: 502 });
  }
}
