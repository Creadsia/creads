import { NextResponse } from "next/server";
import { apiKeyFromRequest, userFromToken } from "@/lib/auth";
import { CORS, originOf } from "@/lib/oauth";
import { handle, type Call } from "@/lib/mcp";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The Creads connector for Claude, ChatGPT and other MCP clients: https://www.creadsia.com/api/mcp
// Without a valid key it answers 401 with where to sign in (OAuth discovery), as the MCP spec asks.

function unauthorized(req: Request) {
  const meta = `${originOf(req)}/.well-known/oauth-protected-resource`;
  return NextResponse.json({ error: "Conecta tu cuenta de Creads." }, { status: 401, headers: { ...CORS, "www-authenticate": `Bearer resource_metadata="${meta}"` } });
}

export async function POST(req: Request) {
  const key = apiKeyFromRequest(req);
  const user = key ? await userFromToken(key) : null;
  if (!user) return unauthorized(req);
  const origin = originOf(req);
  const call: Call = async <T,>(path: string, body?: unknown) => {
    const res = await fetch(`${origin}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "user-agent": "CreadsMCP/1.0" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(240_000),
    });
    const d = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (!res.ok) throw new Error(d.error || `Creads respondió ${res.status}.`);
    return d;
  };
  const body = await req.json().catch(() => undefined);
  if (body === undefined) return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400, headers: CORS });
  const batch = Array.isArray(body);
  const msgs = (batch ? body : [body]).slice(0, 20) as Record<string, unknown>[];
  const out = (await Promise.all(msgs.map((m) => handle(m, call, origin)))).filter(Boolean);
  if (!out.length) return new Response(null, { status: 202, headers: CORS });
  return NextResponse.json(batch ? out : out[0], { headers: CORS });
}

// No server-sent stream and no sessions: every answer comes back in its POST.
export const GET = () => new Response("Usa POST (MCP Streamable HTTP).", { status: 405, headers: { ...CORS, allow: "POST, OPTIONS" } });
export const DELETE = () => new Response(null, { status: 405, headers: CORS });
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
