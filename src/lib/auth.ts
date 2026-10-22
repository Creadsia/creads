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
  /** What this person's workspace may use: the whole studio, or only "Crear anuncio". */
  access?: Access;
  /** Acting through an API key or a connector (not a browser): stricter spending limits apply. */
  viaKey?: boolean;
}
export type Access = "full" | "ads";

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
  // "return=minimal" answers 201/204 with an empty body
  const text = await res.text();
  return text ? JSON.parse(text) : null;
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

/** Accounts of one workspace (customers never see each other's people). */
export async function listUsers(workspace: string): Promise<User[]> {
  return (await rest(`users?workspace=eq.${encodeURIComponent(workspace)}&select=${PUBLIC}&order=created_at.asc`)) as User[];
}

/** One account, only if it belongs to that workspace. */
export async function getUserIn(workspace: string, id: string): Promise<User | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = (await rest(`users?id=eq.${id}&workspace=eq.${encodeURIComponent(workspace)}&select=${PUBLIC}&limit=1`)) as User[];
  return rows[0] ?? null;
}

/** Every account of every workspace (Creadsia's owner panel only). */
/** One account by id (for the connector's token step). */
export async function getUserById(id: string): Promise<User | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = (await rest(`users?id=eq.${encodeURIComponent(id)}&select=${PUBLIC}&limit=1`)) as User[];
  return rows[0] ?? null;
}

export async function listAllUsers(): Promise<User[]> {
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
  forgetUserSessions(id);
  const body: Record<string, unknown> = {};
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.role !== undefined) body.role = patch.role;
  if (patch.active !== undefined) body.active = patch.active;
  if (patch.password) body.password_hash = await hashPassword(patch.password);
  const rows = (await rest(`users?id=eq.${encodeURIComponent(id)}&select=${PUBLIC}`, { method: "PATCH", body: JSON.stringify(body) })) as User[];
  if (patch.password || patch.active === false) await rest(`sessions?user_id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
  return rows[0];
}

/** Two-step verification of an account (null when the columns aren't created yet). */
export async function twoFactorOf(userId: string): Promise<{ secret: string | null; on: boolean } | null> {
  try {
    const rows = (await rest(`users?id=eq.${encodeURIComponent(userId)}&select=totp_secret,totp_on&limit=1`)) as { totp_secret: string | null; totp_on: boolean }[];
    return { secret: rows[0]?.totp_secret ?? null, on: Boolean(rows[0]?.totp_on) };
  } catch (err) {
    // only "the columns don't exist yet" means two-step isn't set up; any other error must not let anyone in
    if (/totp_\w+.*does not exist|column .*totp/i.test(err instanceof Error ? err.message : "")) return null;
    throw err;
  }
}

export async function setTwoFactor(userId: string, secret: string | null, on: boolean) {
  await rest(`users?id=eq.${encodeURIComponent(userId)}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ totp_secret: secret, totp_on: on }) });
}

/** Moves an account to another workspace (e.g. someone added to the owner's team who is really a customer). */
export async function moveUser(id: string, workspace: string) {
  forgetUserSessions(id);
  await rest(`users?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify({ workspace, role: "member" }) });
  forgetUserSessions(id);
}

export async function deleteUser(id: string) {
  forgetUserSessions(id);
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

/**
 * A short session for Creads itself to continue a customer's job in the background (an ad they left open):
 * it lasts minutes, isn't a login (last_login stays as it was) and is ended right after use.
 */
export async function createServiceSession(userId: string, userAgent: string, minutes = 15): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + minutes * 60_000).toISOString();
  await rest("sessions", { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ id: sha(token), user_id: userId, expires_at: expires, user_agent: userAgent.slice(0, 200) }) });
  return token;
}

export async function endSession(token: string) {
  if (!token) return;
  sessionCache.delete(sha(token));
  await rest(`sessions?id=eq.${sha(token)}`, { method: "DELETE", headers: { prefer: "return=minimal" } }).catch(() => {});
}

// A workspace's status and access level, cached for 20 seconds. Until the workspaces table exists
// (supabase/tenancy.sql) every workspace counts as active with full access.
const wsCache = new Map<string, { ok: boolean; access: Access; at: number }>();
async function workspaceInfo(id: string): Promise<{ ok: boolean; access: Access }> {
  const hit = wsCache.get(id);
  if (hit && Date.now() - hit.at < 20_000) return hit;
  let info: { ok: boolean; access: Access } = { ok: true, access: "full" };
  try {
    let rows: { active: boolean; access?: string }[];
    try {
      rows = (await rest(`workspaces?id=eq.${encodeURIComponent(id)}&select=active,access&limit=1`)) as typeof rows;
    } catch {
      // table exists but without the access column yet
      rows = (await rest(`workspaces?id=eq.${encodeURIComponent(id)}&select=active&limit=1`)) as typeof rows;
    }
    info = rows.length
      ? { ok: rows[0].active !== false, access: rows[0].access === "ads" ? "ads" : "full" }
      : { ok: id === "main", access: "full" };
  } catch (err) {
    // table not created yet: don't lock anyone out; any other error: refuse this time (fail closed)
    if (!(err as { missing?: boolean }).missing) return { ok: false, access: "full" };
  }
  wsCache.set(id, { ...info, at: Date.now() });
  return info;
}
export const forgetWorkspace = (id: string) => {
  wsCache.delete(id);
  for (const [k, v] of sessionCache) if (v.user.workspace === id) sessionCache.delete(k);
};
/** Whether people of this workspace may sign in right now. */
export const workspaceOpen = async (id: string) => (await workspaceInfo(id)).ok;

// Every screen and every API call checks the session. Remembering the answer for a few seconds on
// each server saves a database round trip per request (the main cause of a slow-feeling studio).
// Short on purpose: signing out, pausing a customer or deleting an account takes effect within 20 s
// everywhere (immediately on the server that handled it).
const SESSION_TTL = 20_000;
const sessionCache = new Map<string, { user: User; at: number }>();
export const forgetUserSessions = (userId: string) => {
  for (const [k, v] of sessionCache) if (v.user.id === userId) sessionCache.delete(k);
};

/** The signed-in user for a session token, or null. */
export async function userFromToken(token: string | undefined | null): Promise<User | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const key = sha(token);
  const hit = sessionCache.get(key);
  if (hit && Date.now() - hit.at < SESSION_TTL) return hit.user;
  const user = await lookupSession(token);
  if (user) {
    if (sessionCache.size > 2000) sessionCache.clear();
    sessionCache.set(key, { user, at: Date.now() });
  } else sessionCache.delete(key);
  return user;
}

async function lookupSession(token: string): Promise<User | null> {
  try {
    const rows = (await rest(`sessions?id=eq.${sha(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=user:users(${PUBLIC})&limit=1`)) as { user: User | null }[];
    const u = rows[0]?.user;
    if (!u || !u.active) return null;
    const ws = await workspaceInfo(u.workspace);
    // Creadsia's own workspace always has the whole studio
    return ws.ok ? { ...u, access: u.workspace === "main" ? "full" : ws.access } : null;
  } catch {
    return null;
  }
}

export function tokenFromCookieHeader(header: string | null): string {
  const m = (header ?? "").match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : "";
}

/** An API key sent as `Authorization: Bearer creads_sk_…` (empty when there is none). */
export function apiKeyFromRequest(req: Request): string {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(creads_sk_[A-Za-z0-9_-]{30,80})$/);
  return m ? m[1] : "";
}

/**
 * What an API key (or a connector's token) may do: make and follow ads and images, read its own files,
 * avatars, voices and credits. Never the account itself (team, passwords, payments, keys, admin): a
 * leaked key can't take over the account or the team.
 */
const KEY_ROUTES = /^\/api\/(v1\/|mcp$|ads\/start$|clips\/|credits$|cuts$|data\/(ads|clips|avatars|products|scripts)(\/|$)|generate\/|media\/|montage$|review$|scenes$|voices(\/acentos)?$|models$)/;
export const keyMayUse = (req: Request) => {
  try { return KEY_ROUTES.test(new URL(req.url).pathname); } catch { return false; }
};

/** For API routes: the user behind the request's session cookie, or behind its API key (only on the routes a key may use). */
export const userFromRequest = (req: Request) => {
  const key = apiKeyFromRequest(req);
  if (key) return keyMayUse(req) ? userFromToken(key).then((u) => (u ? { ...u, viaKey: true } : null)) : Promise.resolve(null);
  return userFromToken(tokenFromCookieHeader(req.headers.get("cookie")));
};

// ---------- API keys ----------
// An API key is a long-lived session of the account that made it (stored hashed, like every session), so a
// system using it gets exactly what that person gets in the studio: same credits, limits and checks. It is
// shown once. Changing the password or pausing the account ends every key, as it ends every session.
const API_PREFIX = "API · ";
const API_DAYS = 365;
export interface ApiKey { id: string; name: string; created_at: string; expires_at: string }

export async function createApiKey(userId: string, name: string): Promise<{ key: string; info: ApiKey }> {
  const key = `creads_sk_${randomBytes(32).toString("base64url")}`;
  const label = name.replace(/[\r\n]/g, " ").trim().slice(0, 60) || "Clave";
  const expires = new Date(Date.now() + API_DAYS * 86400_000).toISOString();
  const rows = (await rest("sessions?select=id,user_agent,created_at,expires_at", { method: "POST", body: JSON.stringify({ id: sha(key), user_id: userId, expires_at: expires, user_agent: API_PREFIX + label }) })) as { id: string; user_agent: string; created_at: string; expires_at: string }[];
  const r = rows[0];
  return { key, info: { id: r.id.slice(0, 16), name: label, created_at: r.created_at, expires_at: r.expires_at } };
}

export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  const rows = (await rest(`sessions?user_id=eq.${encodeURIComponent(userId)}&user_agent=like.${encodeURIComponent(API_PREFIX + "*")}&select=id,user_agent,created_at,expires_at&order=created_at.desc&limit=50`)) as { id: string; user_agent: string; created_at: string; expires_at: string }[];
  return rows.map((r) => ({ id: r.id.slice(0, 16), name: r.user_agent.slice(API_PREFIX.length), created_at: r.created_at, expires_at: r.expires_at }));
}

/** Ends one key (by the short id shown in the studio). Only the account's own keys. */
export async function revokeApiKey(userId: string, shortId: string): Promise<boolean> {
  if (!/^[0-9a-f]{16}$/.test(shortId)) return false;
  const rows = (await rest(`sessions?user_id=eq.${encodeURIComponent(userId)}&id=like.${shortId}*&user_agent=like.${encodeURIComponent(API_PREFIX + "*")}&select=id`)) as { id: string }[];
  for (const r of rows) {
    sessionCache.delete(r.id);
    await rest(`sessions?id=eq.${r.id}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
  }
  return rows.length > 0;
}

export const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: SESSION_DAYS * 86400 };

/** The owner's own account: can't be removed, and is the only one who names or removes partners. */
export const isTheOwner = (u: User | null) => u?.role === "owner" && u.workspace === "main";
/**
 * Full access to Creadsia (finances, every customer, the Panel interno, shared rules): the owner and his
 * partners ("socios" = role admin in the owner's team). Only the owner can name, change or remove a
 * partner (see /api/team), and the Panel also asks partners for two-step verification (lib/admin.ts).
 */
export const isOwner = (u: User | null) => u?.workspace === "main" && (u.role === "owner" || u.role === "admin");
/** Only the owner gives or removes access (to Creadsia's team here; to customers in the Panel interno). */
export const canManageTeam = (u: User | null) => isOwner(u);
/** "Solo anuncios" accounts can use Crear anuncio and what it needs, nothing else. */
export const hasFullStudio = (u: User | null) => Boolean(u) && (u!.access ?? "full") === "full";
