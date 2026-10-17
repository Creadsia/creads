import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sbRest } from "@/lib/supabase";
import { balanceOf } from "@/lib/credits";
import { planEndingEmail } from "@/lib/emails";
import { emailConfigured, sendEmail } from "@/lib/providers/email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Once a day (vercel.json → crons, 9:00 Chile): customers whose plan ends in 3 days, or today, get an
// email to renew. Only Vercel can call it: it sends CRON_SECRET as a bearer token.

const day = (offset: number) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return secret.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

interface Ws { id: string; plan: string | null; paid_until: string }
interface U { email: string; name: string | null; workspace: string }

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  if (!emailConfigured()) return NextResponse.json({ ok: true, skipped: "sin RESEND_API_KEY" });
  const soon = day(3);
  const today = day(0);
  const ws = await sbRest<Ws[]>(`workspaces?paid_until=in.(${soon},${today})&id=neq.main&select=id,plan,paid_until`);
  if (!ws.length) return NextResponse.json({ ok: true, sent: 0 });
  const users = await sbRest<U[]>(`users?workspace=in.(${ws.map((w) => encodeURIComponent(w.id)).join(",")})&active=eq.true&select=email,name,workspace`);
  let sent = 0;
  for (const w of ws) {
    const credits = await balanceOf(w.id).catch(() => null);
    for (const u of users.filter((x) => x.workspace === w.id)) {
      const ok = await sendEmail(planEndingEmail(u.email, u.name, { plan: w.plan, until: w.paid_until, daysLeft: w.paid_until === today ? 0 : 3, credits }));
      if (ok) sent++;
    }
  }
  return NextResponse.json({ ok: true, sent });
}
