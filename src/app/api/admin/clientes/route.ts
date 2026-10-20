import { after, NextResponse } from "next/server";
import { giveStarterAvatars } from "@/lib/avatares-creads";
import { randomBytes } from "node:crypto";
import { isAdmin } from "@/lib/admin";
import { createUser, findUserByEmail, forgetWorkspace, listAllUsers } from "@/lib/auth";
import { sbHeaders } from "@/lib/supabase";
import { WORKSPACE_RE } from "@/lib/db";
import { allBalances, grant } from "@/lib/credits";

export const dynamic = "force-dynamic";

// Customers (workspaces) for Creadsia's owner: list with people and this month's spend, create, pause.
// The owner sees across workspaces on purpose; customers never reach this route.

interface Workspace { id: string; name: string; kind: string; plan: string | null; active: boolean; access?: string; discount?: number; notes?: string | null; paid_until?: string | null; created_at: string }

function env() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.");
  return { url, key };
}
async function rest(path: string, init: RequestInit = {}) {
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { ...sbHeaders(key), "content-type": "application/json", prefer: "return=representation", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const missing = res.status === 404 || body?.code === "42P01" || body?.code === "PGRST205";
    const err = new Error(missing ? "Falta activar las cuentas separadas: ejecuta supabase/tenancy.sql en Supabase." : `Base de datos: ${body?.message ?? res.statusText}`);
    (err as Error & { missing?: boolean }).missing = missing;
    throw err;
  }
  return body;
}
const fail = (err: unknown) =>
  NextResponse.json({ error: err instanceof Error ? err.message : "Error.", missing: Boolean((err as { missing?: boolean })?.missing) }, { status: 502 });

const tempPassword = () => randomBytes(9).toString("base64url").replace(/[-_]/g, "x") + "-" + randomBytes(2).toString("hex");
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36);

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const month = new Date();
    month.setUTCDate(1);
    month.setUTCHours(0, 0, 0, 0);
    const [workspaces, users, spend, balances] = await Promise.all([
      rest("workspaces?select=*&order=created_at.asc") as Promise<Workspace[]>,
      listAllUsers(),
      rest(`clips?select=owner,usd&created_at=gte.${month.toISOString()}&limit=20000`) as Promise<{ owner: string; usd: number | null }[]>,
      allBalances(),
    ]);
    const usd: Record<string, number> = {};
    for (const c of spend) usd[c.owner] = (usd[c.owner] ?? 0) + Number(c.usd ?? 0);
    return NextResponse.json({
      clientes: workspaces.map((w) => ({
        ...w,
        access: w.access === "ads" ? "ads" : "full",
        discount: Number(w.discount ?? 0),
        people: users.filter((u) => u.workspace === w.id).map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, active: u.active, last_login: u.last_login })),
        usdMonth: +(usd[w.id] ?? 0).toFixed(2),
        balance: balances[w.id] ?? 0,
        paid_until: w.paid_until ?? null,
      })),
    });
  } catch (err) {
    return fail(err);
  }
}

// POST {name, email, contact?, access?, discount?, plan?} creates a customer workspace and its first
// account (a member: only Creadsia's owner manages people). The temporary password is returned once.
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => null);
  const name = String(b?.name ?? "").trim().slice(0, 80);
  const email = String(b?.email ?? "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Escribe el nombre del cliente." }, { status: 400 });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: "Correo inválido." }, { status: 400 });
  try {
    if (await findUserByEmail(email)) return NextResponse.json({ error: "Ya existe una cuenta con ese correo." }, { status: 409 });
    let id = slug(name);
    if (id.length < 3) id = `cliente-${randomBytes(3).toString("hex")}`;
    if (!WORKSPACE_RE.test(id) || id === "main") id = `cliente-${randomBytes(3).toString("hex")}`;
    const taken = (await rest(`workspaces?id=eq.${id}&select=id`)) as { id: string }[];
    if (taken.length) id = `${id.slice(0, 33)}-${randomBytes(2).toString("hex")}`;
    const access = b?.access === "ads" ? "ads" : "full";
    const discount = Math.min(100, Math.max(0, Math.round(Number(b?.discount) || 0)));
    await rest("workspaces", { method: "POST", body: JSON.stringify({ id, name, kind: "client", plan: b?.plan ? String(b.plan).slice(0, 30) : null, access, discount }) });
    const password = tempPassword();
    const user = await createUser({ email, name: String(b?.contact ?? "").slice(0, 60), password, role: "member", workspace: id });
    after(() => giveStarterAvatars(id));
    // starting credits (e.g. for a friend to try it); a failure here doesn't undo the account
    const start = Math.round(Number(b?.credits) || 0);
    if (start > 0 && start <= 100000) await grant(id, start, "topup", "Créditos de bienvenida", "dueño").catch(() => null);
    return NextResponse.json({ workspace: id, user, password });
  } catch (err) {
    return fail(err);
  }
}

// PATCH {id, active?, access?, discount?, plan?, name?, notes?}: pause/resume a customer (paused customers
// can't sign in), change what they can use, or their discount.
export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => null);
  const id = String(b?.id ?? "");
  if (!WORKSPACE_RE.test(id) || id === "main") return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  const patch: Record<string, unknown> = {};
  if (typeof b?.active === "boolean") patch.active = b.active;
  if (typeof b?.plan === "string") patch.plan = b.plan.slice(0, 30) || null;
  if (typeof b?.name === "string" && b.name.trim().length >= 2) patch.name = b.name.trim().slice(0, 80);
  if (b?.access === "full" || b?.access === "ads") patch.access = b.access;
  if (b?.discount !== undefined) patch.discount = Math.min(100, Math.max(0, Math.round(Number(b.discount) || 0)));
  if (typeof b?.notes === "string") patch.notes = b.notes.slice(0, 500) || null;
  if (!Object.keys(patch).length) return NextResponse.json({ error: "Nada que cambiar." }, { status: 400 });
  try {
    const rows = await rest(`workspaces?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    forgetWorkspace(id);
    return NextResponse.json({ cliente: rows?.[0] ?? null });
  } catch (err) {
    return fail(err);
  }
}
