import { NextResponse } from "next/server";
import { CORS, originOf, serverMetadata } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// OAuth discovery for the Creads connector (MCP clients read this to know how to sign in).
export const GET = (req: Request) => NextResponse.json(serverMetadata(originOf(req)), { headers: { ...CORS, "cache-control": "public, max-age=3600" } });
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
