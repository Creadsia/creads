import { NextResponse } from "next/server";
import { CORS, registerClient, SCOPE } from "@/lib/oauth";
import { clientIp, tooMany } from "@/lib/rate";

export const dynamic = "force-dynamic";

// Dynamic client registration (RFC 7591): Claude, ChatGPT or any MCP client registers itself here.
export async function POST(req: Request) {
  const limited = await tooMany("oauth", clientIp(req));
  if (limited) return new NextResponse(limited.body, { status: 429, headers: CORS });
  const b = (await req.json().catch(() => null)) ?? {};
  const r = registerClient(b.client_name, b.redirect_uris);
  if (typeof r === "string") return NextResponse.json({ error: "invalid_redirect_uri", error_description: r }, { status: 400, headers: CORS });
  return NextResponse.json({
    client_id: r.id, client_id_issued_at: Math.floor(Date.now() / 1000), client_name: r.client.name, redirect_uris: r.client.redirects,
    grant_types: ["authorization_code"], response_types: ["code"], token_endpoint_auth_method: "none", scope: SCOPE,
  }, { status: 201, headers: CORS });
}
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
