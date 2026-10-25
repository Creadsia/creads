import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sbRest } from "@/lib/supabase";
import { type Embudo, SITE, embudoEmail } from "@/lib/emails";
import { optedOut, unsubLink } from "@/lib/unsub";
import { once } from "@/lib/marketing";
import { emailConfigured, sendEmail } from "@/lib/providers/email";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Every hour (vercel.json → crons): emails by behaviour (owner's plan, 25 Oct 2026). Off until the owner
// approves the texts: CORREOS_COMPORTAMIENTO=1 in Vercel turns them on. Each email goes once per person.
//   registered, nothing generated: 1 h and 24 h · generated, no payment: day 1, 3 and 5 ·
//   checkout started and not paid: 1 h · (the welcome after paying is sent with the receipt, lib/settle.ts)

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return secret.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

const ago = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
interface U { email: string; name: string | null; workspace: string; created_at: string }

async function generated(ws: string) {
  const r = await sbRest<{ created_at: string }[]>(`clips?owner=eq.${encodeURIComponent(ws)}&status=eq.done&select=created_at&order=created_at.asc&limit=1`).catch(() => []);
  return r[0]?.created_at ?? null;
}
async function paid(ws: string) {
  const r = await sbRest<{ id: string }[]>(`orders?owner=eq.${encodeURIComponent(ws)}&status=eq.pagado&select=id&limit=1`).catch(() => []);
  return r.length > 0;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (process.env.CORREOS_COMPORTAMIENTO !== "1") return NextResponse.json({ ok: true, apagado: true });
  if (!emailConfigured()) return NextResponse.json({ ok: false, error: "Falta configurar el correo." });
  const out = await optedOut();
  const sent: Record<string, number> = {};
  const send = async (u: { email: string; name: string | null }, tipo: Embudo, key: string) => {
    if (out.has(u.email.toLowerCase())) return;
    if (!(await once(`embudo:${tipo}:${key}`, 400 * 86400))) return; // already sent
    if (await sendEmail(embudoEmail(u.email, u.name, tipo, unsubLink(SITE, u.email)))) sent[tipo] = (sent[tipo] ?? 0) + 1;
  };

  // people who signed up in the last 6 days (enough for every step)
  const users = await sbRest<U[]>(`users?created_at=gte.${ago(6 * 24 + 2)}&workspace=neq.main&active=eq.true&select=email,name,workspace,created_at&limit=2000`).catch(() => [] as U[]);
  for (const u of users) {
    const hours = (Date.now() - Date.parse(u.created_at)) / 3600_000;
    const first = await generated(u.workspace);
    if (!first) {
      if (hours >= 24 && hours < 48) await send(u, "sin-generar-24h", u.workspace);
      else if (hours >= 1 && hours < 24) await send(u, "sin-generar-1h", u.workspace);
      continue;
    }
    if (await paid(u.workspace)) continue;
    const days = (Date.now() - Date.parse(first)) / 86400_000;
    if (days >= 5 && days < 6) await send(u, "sin-pagar-5", u.workspace);
    else if (days >= 3 && days < 4) await send(u, "sin-pagar-3", u.workspace);
    else if (days >= 1 && days < 2) await send(u, "sin-pagar-1", u.workspace);
  }

  // checkouts started 1 to 24 hours ago and still not paid (free trials don't count)
  const orders = await sbRest<{ id: string; owner: string; email: string; mp: { trial?: string } | null }[]>(`orders?status=eq.pendiente&created_at=lte.${ago(1)}&created_at=gte.${ago(24)}&select=id,owner,email,mp&limit=500`).catch(() => []);
  for (const o of orders) {
    if (o.mp?.trial || !o.email || (await paid(o.owner))) continue;
    await send({ email: o.email, name: null }, "checkout-1h", o.id);
  }
  return NextResponse.json({ ok: true, sent });
}
