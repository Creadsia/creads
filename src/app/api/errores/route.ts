import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/auth";
import { logError } from "@/lib/errlog";
import { clientIp, tooMany } from "@/lib/rate";

// POST {message, path} from the browser's error catcher. Anyone can call it (visitors too), so it's
// limited per connection and only short text is kept.
export async function POST(req: Request) {
  const limited = await tooMany("clientErr", clientIp(req));
  if (limited) return new NextResponse(null, { status: 204 });
  const b = await req.json().catch(() => null);
  const message = typeof b?.message === "string" ? b.message.slice(0, 500) : "";
  const path = typeof b?.path === "string" && /^\/[\w\-/.]{0,120}$/.test(b.path) ? b.path : undefined;
  if (message.trim()) {
    const u = await userFromRequest(req).catch(() => null);
    await logError({ area: "navegador", message, path, ws: u?.workspace });
  }
  return new NextResponse(null, { status: 204 });
}
