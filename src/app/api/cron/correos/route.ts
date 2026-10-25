import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sbRest } from "@/lib/supabase";
import type { Embudo } from "@/lib/emails";
import { optedOut } from "@/lib/unsub";
import { emailConfigured } from "@/lib/providers/email";
import { enviarEmbudo } from "@/lib/embudo-envio";
import { hasPaidBefore, packParaDescontar } from "@/lib/billing";
import { PRUEBA, PRUEBA_DESCUENTO_DIAS, usd } from "@/lib/catalog";
import { fechaChile, tocaPackDia5, vencePack } from "@/lib/correos-activacion";
import { tocaPedirTestimonio } from "@/lib/caso-fundador";
import { cambiarCaso, listarCasos } from "@/lib/casos";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Every hour (vercel.json → crons): emails by behaviour (owner's plan, 25 Oct 2026). Off until the owner
// approves the texts: CORREOS_COMPORTAMIENTO=1 in Vercel turns them on. Each email goes once per person.
//   registered, nothing generated: 1 h and 24 h · generated, no payment: day 1, 3 and 5 ·
//   checkout started and not paid: 1 h · Pack Prueba day 5: the discount's real deadline ·
//   Pack Prueba day 14, only to those who ticked «Caso fundador»: the testimonial request
//   (the welcome after paying is sent with the receipt, lib/settle.ts; «tu tanda está lista» by /api/tanda)

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
async function nameOf(email: string) {
  const r = await sbRest<{ name: string | null }[]>(`users?email=eq.${encodeURIComponent(email.toLowerCase())}&select=name&limit=1`).catch(() => []);
  return r[0]?.name ?? null;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (process.env.CORREOS_COMPORTAMIENTO !== "1") return NextResponse.json({ ok: true, apagado: true });
  if (!emailConfigured()) return NextResponse.json({ ok: false, error: "Falta configurar el correo." });
  const bajas = await optedOut();
  const sent: Record<string, number> = {};
  const send = async (u: { email: string; name: string | null }, tipo: Embudo, key: string, vars?: Record<string, string>) => {
    const ok = await enviarEmbudo(u, tipo, key, { vars, bajas });
    if (ok) sent[tipo] = (sent[tipo] ?? 0) + 1;
    return ok;
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

  // Pack Prueba, day 5: the discount on the first plan is still on (same check as /api/pagos), with its real deadline
  const packs = await sbRest<{ id: string; owner: string; email: string; closed_at: string }[]>(`orders?item=eq.${PRUEBA.id}&status=eq.pagado&closed_at=lte.${ago(5 * 24)}&closed_at=gte.${ago(6 * 24)}&select=id,owner,email,closed_at&limit=500`).catch(() => []);
  for (const o of packs) {
    if (!o.email || !tocaPackDia5(o.closed_at)) continue;
    if (await hasPaidBefore(o.owner)) continue;
    const pack = await packParaDescontar(o.owner, PRUEBA_DESCUENTO_DIAS);
    if (pack?.order !== o.id) continue;
    const { fecha, hora } = fechaChile(vencePack(o.closed_at));
    await send({ email: o.email, name: await nameOf(o.email) }, "pack-dia-5", o.owner, { monto: usd(pack.usd), fecha, hora });
  }

  // «Caso fundador», day 14 after the Pack Prueba payment: only people who ticked the box at checkout
  const casos = (await listarCasos().catch(() => [])).filter((c) => c.estado === "inscrito");
  for (const c of casos) {
    const p = await sbRest<{ closed_at: string }[]>(`orders?owner=eq.${encodeURIComponent(c.ws)}&item=eq.${PRUEBA.id}&status=eq.pagado&select=closed_at&order=closed_at.asc&limit=1`).catch(() => []);
    if (!tocaPedirTestimonio(c, p[0]?.closed_at)) continue;
    if (await send({ email: c.email, name: c.name }, "caso-dia-14", c.userId)) {
      const fecha = new Date().toISOString();
      await cambiarCaso(c.userId, (cur) => (cur?.estado === "inscrito" ? { ...cur, estado: "pedido", pedidoEn: fecha, historial: [...cur.historial, { estado: "pedido", fecha, por: "correo" }] } : null)).catch(() => null);
    }
  }
  return NextResponse.json({ ok: true, sent });
}
