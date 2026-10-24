import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sbRest } from "@/lib/supabase";
import { balanceOf } from "@/lib/credits";
import { type ActivationStep, SITE, activationEmail, ownerReportEmail, planEndingEmail, winbackEmail } from "@/lib/emails";
import { optedOut, unsubLink } from "@/lib/unsub";
import { dailyReport } from "@/lib/daily-report";
import { runExpiry } from "@/lib/expiry";
import { observedDollar } from "@/lib/usd-clp";
import { emailConfigured, sendEmail } from "@/lib/providers/email";
import { watchFailures } from "@/lib/genstats";
import { reconcileSubscription } from "@/lib/settle";

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

/** First-week tips (day 1, 3 and 7 after signing up), unless the person opted out. */
async function activation(): Promise<number> {
  let sent = 0;
  const out = await optedOut(); // can't read who opted out → no tips today (the caller logs it)
  for (const step of [1, 3, 7] as ActivationStep[]) {
    const from = day(-step), to = day(-step + 1);
    const users = await sbRest<{ email: string; name: string | null; workspace: string }[]>(`users?created_at=gte.${from}&created_at=lt.${to}&workspace=neq.main&active=eq.true&select=email,name,workspace&limit=1000`).catch(() => []);
    for (const u of users) {
      if (out.has(u.email.toLowerCase())) continue;
      const [ads, ws] = await Promise.all([
        sbRest<{ id: string }[]>(`ads?owner=eq.${encodeURIComponent(u.workspace)}&select=id&limit=50`).catch(() => []),
        sbRest<{ paid_until: string | null }[]>(`workspaces?id=eq.${encodeURIComponent(u.workspace)}&select=paid_until&limit=1`).catch(() => []),
      ]);
      const hasPlan = Boolean(ws[0]?.paid_until && ws[0].paid_until >= day(0));
      if (await sendEmail(activationEmail(u.email, u.name, { step, hasPlan, ads: ads.length, unsub: unsubLink(SITE, u.email) }))) sent++;
    }
  }
  return sent;
}

/** 3 and 14 days after a plan ended (and wasn't renewed): «tu estudio sigue aquí» / «¿qué te faltó?». */
async function winback(): Promise<number> {
  let sent = 0;
  const out = await optedOut();
  for (const daysAgo of [3, 14] as const) {
    const ended = await sbRest<Ws[]>(`workspaces?paid_until=eq.${day(-daysAgo)}&id=neq.main&select=id,plan,paid_until`).catch(() => [] as Ws[]);
    for (const w of ended) {
      const [users, ads] = await Promise.all([
        sbRest<U[]>(`users?workspace=eq.${encodeURIComponent(w.id)}&active=eq.true&select=email,name,workspace&limit=20`).catch(() => [] as U[]),
        sbRest<{ id: string }[]>(`ads?owner=eq.${encodeURIComponent(w.id)}&select=id&limit=500`).catch(() => []),
      ]);
      for (const u of users) {
        if (out.has(u.email.toLowerCase())) continue;
        if (await sendEmail(winbackEmail(u.email, u.name, { daysAgo, plan: w.plan, ads: ads.length, unsub: unsubLink(SITE, u.email) }))) sent++;
      }
    }
  }
  return sent;
}

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
  await observedDollar(true).catch(() => null); // today's dollar for the prices charged in pesos
  const expiry = await runExpiry().catch((e) => { console.error("expiry", e instanceof Error ? e.message : e); return null; });
  if (!emailConfigured()) return NextResponse.json({ ok: true, expiry, skipped: "sin RESEND_API_KEY" });
  const tips = await activation().catch((e) => { console.error("activation", e instanceof Error ? e.message : e); return 0; });
  const volver = await winback().catch((e) => { console.error("winback", e instanceof Error ? e.message : e); return 0; });
  // sign-ups that never used their gift ad (once each, a day after signing up)
  const regalo = await import("@/lib/regalo-recordatorio").then((m) => m.enviarRecordatorios(20)).catch((e) => { console.error("regalo recordatorio", e instanceof Error ? e.message : e); return null; });
  if (regalo?.enviados) console.warn("recordatorios de regalo", regalo);
  // subscription charges whose Mercado Pago notice never arrived (last 40 days): looked up and applied once
  const since = new Date(Date.now() - 40 * 86_400_000).toISOString();
  const subs40 = await sbRest<{ id: string }[]>(`orders?mp->>kind=eq.subscription&status=in.(pendiente,pagado)&created_at=gte.${encodeURIComponent(since)}&select=id&limit=500`).catch(() => []);
  let cuadrados = 0;
  for (const o of subs40) cuadrados += await reconcileSubscription(o.id).catch(() => 0);
  if (cuadrados) console.warn("pagos cuadrados por la revisión diaria", cuadrados);
  const soon = day(3);
  const today = day(0);
  const ws = await sbRest<Ws[]>(`workspaces?paid_until=in.(${soon},${today})&id=neq.main&select=id,plan,paid_until`);
  if (!ws.length) {
    await ownerReport(expiry?.expired ?? 0, 0);
    return NextResponse.json({ ok: true, sent: 0, tips, volver, expiry });
  }
  const users = await sbRest<U[]>(`users?workspace=in.(${ws.map((w) => encodeURIComponent(w.id)).join(",")})&active=eq.true&select=email,name,workspace`);
  let sent = 0;
  // customers with an automatic monthly renewal get "se renueva solo", not "renueva tu plan"
  const subs = await sbRest<{ owner: string; mp: { kind?: string; cancelled?: boolean } | null }[]>(`orders?owner=in.(${ws.map((w) => encodeURIComponent(w.id)).join(",")})&status=eq.pagado&select=owner,mp&limit=10000`).catch(() => []);
  const renewing = new Set(subs.filter((o) => o.mp?.kind === "subscription" && !o.mp.cancelled).map((o) => o.owner));
  for (const w of ws) {
    const credits = await balanceOf(w.id).catch(() => null);
    for (const u of users.filter((x) => x.workspace === w.id)) {
      const ok = await sendEmail(planEndingEmail(u.email, u.name, { plan: w.plan, until: w.paid_until, daysLeft: w.paid_until === today ? 0 : 3, credits, renews: renewing.has(w.id) }));
      if (ok) sent++;
    }
  }
  await ownerReport(expiry?.expired ?? 0, ws.filter((w) => w.paid_until === soon).length);
  await watchFailures(true);
  return NextResponse.json({ ok: true, sent, tips, volver, expiry });
}
