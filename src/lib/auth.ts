import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { sbHeaders } from "./supabase";

// Accounts and sessions. Passwords are stored as scrypt hashes; the browser keeps a random session token
// in an http-only cookie and the database only keeps its SHA-256, so a leaked table can't open sessions.
// Roles: owner (everything, including finance), admin (everything but finance and the owner), member (the studio).

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export const SESSION_COOKIE = "creads_session";
export const SESSION_DAYS = 30;

export type Role = "owner" | "admin" | "member";
export interface User {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  workspace: string;
  active: boolean;
  created_at: string;
  last_login: string | null;
}

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
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const missing = res.status === 404 || body?.code === "42P01" || body?.code === "PGRST205";
    const err = new Error(missing ? "Faltan las tablas de cuentas en Supabase (hay que ejecutar el SQL)." : `Base de datos: ${body?.message ?? res.statusText}`);
    (err as Error & { missing?: boolean }).missing = missing;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}

const PUBLIC = "id,email,name,role,workspace,active,created_at,last_login";
export const normEmail = (e: string) => e.trim().toLowerCase();
const sha = (t: string) => createHash("sha256").update(t).digest("hex");

// ---------- passwords ----------
export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}
export async function verifyPassword(pw: string, stored: string) {
  const [alg, s, k] = stored.split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const key = await scrypt(pw, Buffer.from(s, "hex"), 64, { N: 16384, r: 8, p: 1 });
  const want = Buffer.from(k, "hex");
  return want.length === key.length && timingSafeEqual(want, key);
}
export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "La clave debe tener al menos 10 caracteres.";
  if (pw.length > 200) return "La clave es demasiado larga.";
  return null;
}

// ---------- users ----------
export async function countUsers(): Promise<number> {
  const { url, key } = env();
  const res = await fetch(`${url}/rest/v1/users?select=id&limit=1`, { headers: { ...sbHeaders(key), prefer: "count=exact" }, cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    if (res.status === 404 || body?.code === "42P01" || body?.code === "PGRST205") return -1; // tables missing
    throw new Error("No se pudo revisar las cuentas.");
  }
  return Number((res.headers.get("content-range") ?? "").split("/")[1] ?? 0) || 0;
}

export async function findUserByEmail(email: string): Promise<(User & { password_hash: string }) | null> {
  const rows = (await rest(`users?email=eq.${encodeURIComponent(normEmail(email))}&select=${PUBLIC},password_hash&limit=1`)) as (User & { password_hash: string })[];
  return rows[0] ?? null;
}

export async function listUsers(): Promise<User[]> {
  return (await rest(`users?select=${PUBLIC}&order=created_at.asc`)) as User[];
}

export async function createUser(u: { email: string; name?: string; password: string; role: Role; workspace?: string }): Promise<User> {
  const rows = (await rest(`users?select=${PUBLIC}`, {
    method: "POST",
    body: JSON.stringify({ email: normEmail(u.email), name: u.name?.trim() || null, password_hash: await hashPassword(u.password), role: u.role, workspace: u.workspace ?? "main" }),
  })) as User[];
  return rows[0];
}

export async function updateUser(id: string, patch: Partial<Pick<User, "name" | "role" | "active">> & { password?: string }): Promise<User> {
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.role !== undefined) body.role = patch.role;
  if (patch.active !== undefined) body.active = patch.active;
  if (patch.password) body.password_hash = await hashPassword(patch.password);
  const rows = (await rest(`users?id=eq.${encodeURIComponent(id)}&select=${PUBLIC}`, { method: "PATCH", body: JSON.stringify(body) })) as User[];
  if (patch.password || patch.active === false) await rest(`sessions?user_id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
  return rows[0];
}

export async function deleteUser(id: string) {
  await rest(`users?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
}

// ---------- sessions ----------
export async function createSession(userId: string, userAgent = ""): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  await rest("sessions", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ id: sha(token), user_id: userId, expires_at: expires, user_agent: userAgent.slice(0, 200) }) });
  await rest(`users?id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ last_login: new Date().toISOString() }) });
  return token;
}

export async function endSession(token: string) {
  if (!token) return;
  await rest(`sessions?id=eq.${sha(token)}`, { method: "DELETE", headers: { prefer: "return=minimal" } }).catch(() => {});
}

/** The signed-in user for a session token, or null. */
export async function userFromToken(token: string | undefined | null): Promise<User | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  try {
    const rows = (await rest(`sessions?id=eq.${sha(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=user:users(${PUBLIC})&limit=1`)) as { user: User | null }[];
    const u = rows[0]?.user;
    return u && u.active ? u : null;
  } catch {
    return null;
  }
}

export function tokenFromCookieHeader(header: string | null): string {
  const m = (header ?? "").match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

/** For API routes: the user behind the request's session cookie. */
export const userFromRequest = (req: Request) => userFromToken(tokenFromCookieHeader(req.headers.get("cookie")));

export const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: SESSION_DAYS * 86400 };

export const canManageTeam = (u: User | null) => u?.role === "owner" || u?.role === "admin";
export const isOwner = (u: User | null) => u?.role === "owner";
