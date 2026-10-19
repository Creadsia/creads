import { NextResponse } from "next/server";
import { CORS, originOf, serverMetadata } from "@/lib/oauth";

export const dynamic = "force-dynamic";

// Some clients look for the sign-in details here instead (same answer).
export const GET = (req: Request) => NextResponse.json(serverMetadata(originOf(req)), { headers: { ...CORS, "cache-control": "public, max-age=3600" } });
export const OPTIONS = () => new Response(null, { status: 204, headers: CORS });
