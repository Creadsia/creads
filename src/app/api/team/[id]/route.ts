import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { canManageTeam, deleteUser, getUserIn, isOwner, moveUser, updateUser, userFromRequest } from "@/lib/auth";
import { publicError } from "@/lib/public-error";
import { createClientWorkspace } from "@/lib/signup";

type Ctx = { params: Promise<{ id: string }> };
const tempPassword = () => randomBytes(9).toString("base64url").replace(/[-_]/g, "x") + "-" + randomBytes(2).toString("hex");

// PATCH {role?, active?, name?, resetPassword?}: owners and admins manage the team; nobody can touch the owner but the owner.
export async function PATCH(req: Request, { params }: Ctx) {
  const me = await userFromRequest(req);
  if (!canManageTeam(me)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const { id } = await params;
  const target = await getUserIn(me!.workspace, id);
  if (!target) return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
  if (target.role === "owner" && me!.id !== target.id) return NextResponse.json({ error: "La cuenta del dueño solo la cambia el dueño." }, { status: 403 });
  const b = await req.json().catch(() => null);
  // "Pasar a cuenta de cliente": the person gets their own workspace (own avatars, ads and credits)
  // and stops seeing the owner's. Only Creadsia's owner, only for people of the owner's team.
  if (b?.toClient === true) {
    if (!isOwner(me) || target.role === "owner") return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    try {
      const ws = await createClientWorkspace(target.name || target.email.split("@")[0]);
      await moveUser(target.id, ws);
      return NextResponse.json({ moved: true, workspace: ws });
    } catch (err) {
      return NextResponse.json({ error: publicError(err, "No se pudo mover.") }, { status: 502 });
    }
  }
  const patch: Parameters<typeof updateUser>[1] = {};
  if (typeof b?.name === "string") patch.name = b.name.slice(0, 60);
  if (b?.role === "admin" || b?.role === "member") {
    if (me!.role !== "owner") return NextResponse.json({ error: "Solo el dueño cambia roles." }, { status: 403 });
    if (target.role === "owner") return NextResponse.json({ error: "El dueño no puede quitarse su propio rol." }, { status: 400 });
    patch.role = b.role;
  }
  if (typeof b?.active === "boolean") {
    if (target.role === "owner") return NextResponse.json({ error: "La cuenta del dueño no se puede desactivar." }, { status: 400 });
    patch.active = b.active;
  }
  let password: string | undefined;
  if (b?.resetPassword) { password = tempPassword(); patch.password = password; }
  const user = await updateUser(id, patch);
  return NextResponse.json({ user, password });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const me = await userFromRequest(req);
  if (!canManageTeam(me)) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  const { id } = await params;
  const target = await getUserIn(me!.workspace, id);
  if (!target) return NextResponse.json({ ok: true });
  if (target.role === "owner") return NextResponse.json({ error: "La cuenta del dueño no se puede borrar." }, { status: 400 });
  if (target.role === "admin" && me!.role !== "owner") return NextResponse.json({ error: "Solo el dueño borra administradores." }, { status: 403 });
  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
