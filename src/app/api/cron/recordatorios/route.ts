import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sbRest } from "@/lib/supabase";
import { balanceOf } from "@/lib/credits";
import { ownerReportEmail, planEndingEmail } from "@/lib/emails";
import { dailyReport } from "@/lib/daily-report";
import { runExpiry } from "@/lib/expiry";
import { emailConfigured, sendEmail } from "@/lib/providers/email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Once a day (vercel.json → crons, 9:00 Chile): credits of ended periods expire, customers whose plan
// ends in 3 days or today get an email to renew, and the owner gets yesterday's summary. Only Vercel can call it: it sends CRON_SECRET as a bearer token.

const day = (offset: number) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10);

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return secret.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

interface Ws { id: string; plan: string | null; paid_until: string }
interface U { email: string; name: string | null; workspace: string }

/** The owner's morning summary (never blocks the customers' emails). */
async function ownerReport(expired: number, ending: number) {
  try {
    const owners = await sbRest<{ email: string }[]>("users?workspace=eq.main&role=eq.owner&active=eq.true&select=email&limit=1");
    if (!owners[0]?.email) return;
    await sendEmail(ownerReportEmail(owners[0].email, await dailyReport({ expired, ending })));
  } catch (err) {
    console.error("owner report", err instanceof Error ? err.message : err);
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "no autorizado" }, { status: 401 });
  // credits of periods that ended expire (before the reminders, which mention what's left)
  const expiry = await runExpiry().catch((e) => { console.error("expiry", e instanceof Error ? e.message : e); return null; });
  if (!emailConfigured()) return NextResponse.json({ ok: true, expiry, skipped: "sin RESEND_API_KEY" });
  const soon = day(3);
  const today = day(0);
  const ws = await sbRest<Ws[]>(`workspaces?paid_until=in.(${soon},${today})&id=neq.main&select=id,plan,paid_until`);
  if (!ws.length) {
    await ownerReport(expiry?.expired ?? 0, 0);
    return NextResponse.json({ ok: true, sent: 0, expiry });
  }
  const users = await sbRest<U[]>(`users?workspace=in.(${ws.map((w) => encodeURIComponent(w.id)).join(",")})&active=eq.true&select=email,name,workspace`);
  let sent = 0;
  for (const w of ws) {
    const credits = await balanceOf(w.id).catch(() => null);
    for (const u of users.filter((x) => x.workspace === w.id)) {
      const ok = await sendEmail(planEndingEmail(u.email, u.name, { plan: w.plan, until: w.paid_until, daysLeft: w.paid_until === today ? 0 : 3, credits }));
      if (ok) sent++;
    }
  }
  await ownerReport(expiry?.expired ?? 0, ws.filter((w) => w.paid_until === soon).length);
  return NextResponse.json({ ok: true, sent, expiry });
}
