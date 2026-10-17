import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { agentsOf, loadState, runAll } from "@/lib/oficina";
import { officeEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/providers/email";
import { logError } from "@/lib/errlog";
import { sbRest } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Once a day (vercel.json → crons, 8:00 Chile): the agent office works and the CEO's brief goes to the
// owner by email. Only Vercel can call it: it sends CRON_SECRET as a bearer token.

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return secret.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const { ceo, ran } = await runAll();
    if (ceo?.error) {
      const rows = await sbRest<{ email: string }[]>("users?workspace=eq.main&role=eq.owner&active=eq.true&select=email&limit=1").catch(() => []);
      if (rows[0]?.email) await sendEmail(officeEmail(rows[0].email, { resumen: "La oficina no pudo hacer el resumen de hoy", prioridades: [], informe: `El CEO ${ceo.resumen.replace(/^No pudo trabajar: /, "no pudo trabajar: ")}`, estado: "atencion", alertas: [] }));
    } else if (ceo) {
      const st = await loadState();
      const rows = await sbRest<{ email: string }[]>("users?workspace=eq.main&role=eq.owner&active=eq.true&select=email&limit=1").catch(() => []);
      const fresh = Date.now() - 26 * 3600_000;
      const alertas = agentsOf(st).filter((w) => w.id !== "ceo" && w.on).flatMap((w) => {
        const r = st.last[w.id];
        if (!r || r.estado === "ok" || Date.parse(r.at) < fresh) return [];
        return [[w.name, `${r.error ? "No pudo trabajar" : r.estado === "urgente" ? "Urgente" : "Revisar"}: ${r.resumen}`.slice(0, 160)] as [string, string]];
      });
      if (rows[0]?.email) await sendEmail(officeEmail(rows[0].email, { resumen: ceo.resumen, prioridades: ceo.prioridades ?? [], informe: ceo.informe, estado: ceo.estado, alertas }));
    }
    return NextResponse.json({ ok: true, ran });
  } catch (err) {
    await logError({ area: "cron", message: `Oficina: ${err instanceof Error ? err.message : String(err)}` }).catch(() => {});
    return NextResponse.json({ error: "La oficina no pudo trabajar hoy." }, { status: 500 });
  }
}
