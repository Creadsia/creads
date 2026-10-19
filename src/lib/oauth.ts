import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { readPrivateJSON, writePrivateJSON } from "./supabase";
import { createApiKey, listApiKeys, revokeApiKey } from "./auth";

// OAuth 2.1 for the Creads connector (Claude, ChatGPT and any MCP client): the user signs in to Creads,
// approves the app, and the app gets an API key of that account (the same kind made in «API para sistemas»,
// so it shows up there and can be ended there). Clients register themselves (RFC 7591) without a table:
// the client id carries its name and redirect addresses, signed by Creads. PKCE (S256) is required.

const secret = () => process.env.OAUTH_SECRET || createHash("sha256").update(`creads-oauth:${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`).digest("hex");
const sign = (s: string) => createHmac("sha256", secret()).update(s).digest("base64url").slice(0, 32);
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const safeEq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export const SCOPE = "creads";
export const TOKEN_DAYS = 365;

/** Where an app may send the user back: https anywhere, or http only to the user's own machine. */
export function okRedirect(u: unknown): u is string {
  if (typeof u !== "string" || u.length > 500) return false;
  try {
    const x = new URL(u);
    if (x.hash || x.username || x.password) return false;
    return x.protocol === "https:" || (x.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(x.hostname));
  } catch { return false; }
}

export interface Client { name: string; redirects: string[] }
const cleanName = (n: unknown) => (typeof n === "string" ? n.replace(/[^\p{L}\p{N} .,_()-]/gu, "").trim().slice(0, 40) : "") || "Aplicación";

/** A client id for an app (its name and redirect addresses, signed). */
export function registerClient(name: unknown, redirects: unknown): { id: string; client: Client } | string {
  if (!Array.isArray(redirects) || !redirects.length || redirects.length > 5) return "Manda entre 1 y 5 redirect_uris.";
  if (!redirects.every(okRedirect)) return "Cada redirect_uri debe ser https (o http a localhost).";
  const client = { name: cleanName(name), redirects: [...new Set(redirects as string[])] };
  const body = Buffer.from(JSON.stringify({ n: client.name, r: client.redirects })).toString("base64url");
  return { id: `cr_${body}.${sign(body)}`, client };
}

export function readClient(id: unknown): Client | null {
  if (typeof id !== "string" || id.length > 3000) return null;
  const m = id.match(/^cr_([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{32})$/);
  if (!m || !safeEq(sign(m[1]), m[2])) return null;
  try {
    const d = JSON.parse(Buffer.from(m[1], "base64url").toString()) as { n?: string; r?: string[] };
    return Array.isArray(d.r) && d.r.every(okRedirect) ? { name: cleanName(d.n), redirects: d.r } : null;
  } catch { return null; }
}

/** Checks an authorization request; returns the client, or a message to show (never redirected). */
export function checkRequest(p: Record<string, string | undefined>): { client: Client } | string {
  const client = readClient(p.client_id);
  if (!client) return "Esta aplicación no está registrada correctamente. Vuelve a conectarla desde la app.";
  if (!p.redirect_uri || !client.redirects.includes(p.redirect_uri)) return "La dirección de regreso no coincide con la aplicación.";
  if (p.response_type !== "code") return "Tipo de solicitud no soportado.";
  if (!p.code_challenge || p.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(p.code_challenge)) return "Falta la verificación PKCE (S256).";
  if (p.state && p.state.length > 500) return "Solicitud inválida.";
  return { client };
}

interface Code { userId: string; clientId: string; redirectUri: string; challenge: string; exp: number; used: boolean }
const codeFile = (code: string) => `oauth/codes/${sha(code)}.json`;

/** A one-time code (10 minutes) after the user approved. */
export async function issueCode(o: { userId: string; clientId: string; redirectUri: string; challenge: string }): Promise<string> {
  const code = randomBytes(32).toString("base64url");
  await writePrivateJSON(codeFile(code), { ...o, exp: Date.now() + 10 * 60_000, used: false } satisfies Code);
  return code;
}

/** The code for a token: same app, same address, the PKCE secret matches, used once. Returns the user id. */
export async function redeemCode(o: { code: string; clientId: string; redirectUri: string; verifier: string }): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(o.code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(o.verifier)) return null;
  const c = await readPrivateJSON<Code>(codeFile(o.code)).catch(() => null);
  if (!c || c.used || c.exp < Date.now() || c.clientId !== o.clientId || c.redirectUri !== o.redirectUri) return null;
  await writePrivateJSON(codeFile(o.code), { ...c, used: true });
  const challenge = createHash("sha256").update(o.verifier).digest("base64url");
  return safeEq(challenge, c.challenge) ? c.userId : null;
}

/** The access token: an API key named after the app; older keys of the same app beyond the last 2 are ended. */
export async function tokenFor(userId: string, client: Client): Promise<string> {
  const label = `${client.name} (conector)`;
  const old = (await listApiKeys(userId).catch(() => [])).filter((k) => k.name === label);
  for (const k of old.slice(2)) await revokeApiKey(userId, k.id).catch(() => false);
  return (await createApiKey(userId, label)).key;
}

/** Where everything lives, from the request's own address (so staging answers for staging). */
export const originOf = (req: Request) => {
  const u = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") ?? u.host;
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  return `${proto}://${host}`;
};
export const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "authorization, content-type, mcp-protocol-version, mcp-session-id", "access-control-expose-headers": "www-authenticate, mcp-session-id" };

export const resourceMetadata = (origin: string) => ({
  resource: `${origin}/api/mcp`, authorization_servers: [origin], scopes_supported: [SCOPE], bearer_methods_supported: ["header"],
  resource_name: "Creads", resource_documentation: `${origin}/app/api`,
});
export const serverMetadata = (origin: string) => ({
  issuer: origin, authorization_endpoint: `${origin}/app/conectar`, token_endpoint: `${origin}/api/oauth/token`, registration_endpoint: `${origin}/api/oauth/register`,
  response_types_supported: ["code"], grant_types_supported: ["authorization_code"], code_challenge_methods_supported: ["S256"],
  token_endpoint_auth_methods_supported: ["none"], scopes_supported: [SCOPE], service_documentation: `${origin}/app/api`,
});
