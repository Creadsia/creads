import { after, NextResponse } from "next/server";
import { once } from "@/lib/marketing";
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
  // a second heartbeat for customers' ads nobody is watching (owner, 24 Oct 2026: a gift ad stayed
  // «generando» after the customer closed Automático): while anyone is on the site, at most every 2 minutes
  after(async () => {
    const secret = (process.env.CRON_SECRET ?? "").trim();
    if (secret.length < 16 || !(await once("beat-sweep-anuncios", 120))) return;
    const { SITE } = await import("@/lib/emails");
    await fetch(`${SITE}/api/cron/anuncios`, { method: "POST", headers: { authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(4000) }).catch(() => {});
  });
  return new NextResponse(null, { status: 204 });
}
