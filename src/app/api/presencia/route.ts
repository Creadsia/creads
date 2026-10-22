import { NextResponse } from "next/server";
import { allow, clientIp } from "@/lib/rate";
import { TAB, beat, pageOf } from "@/lib/presence";

export const dynamic = "force-dynamic";

// POST {id, path}: «this tab is open on this page» (anonymous; see lib/presence.ts).
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const id = String(b?.id ?? "");
  if (!TAB.test(id)) return new NextResponse(null, { status: 204 });
  if (!(await allow("beat", clientIp(req)))) return new NextResponse(null, { status: 204 });
  await beat(id, pageOf(String(b?.path ?? "/"))).catch(() => null);
  return new NextResponse(null, { status: 204 });
}
