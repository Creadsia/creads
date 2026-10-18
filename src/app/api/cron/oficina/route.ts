import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { agentsOf, loadState, runAll } from "@/lib/oficina";
import { runGuardian } from "@/lib/guardian";
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
    await runGuardian().catch((e) => console.error("guardian", e instanceof Error ? e.message : e)); // a check before the office reads it
    const { brief, by, ran } = await runAll();
    const rows = brief ? await sbRest<{ email: string }[]>("users?workspace=eq.main&role=eq.owner&active=eq.true&select=email&limit=1").catch(() => []) : [];
    const to = rows[0]?.email;
    if (brief?.error) {
      if (to) await sendEmail(officeEmail(to, { resumen: "La oficina no pudo hacer el resumen de hoy", prioridades: [], informe: `El ${by === "general" ? "CEO General" : "Director de Plataforma"} ${brief.resumen.replace(/^No pudo trabajar: /, "no pudo trabajar: ")}`, estado: "atencion", alertas: [] }));
    } else if (brief) {
      // the one official brief: the CEO General's (or the Director's when the CEO General couldn't work)
      const st = await loadState();
      const fresh = Date.now() - 26 * 3600_000;
      const alertas = agentsOf(st).filter((w) => w.id !== by && w.on).flatMap((w) => {
        const r = st.last[w.id];
        if (!r || r.estado === "ok" || Date.parse(r.at) < fresh) return [];
        return [[w.name, `${r.error ? "No pudo trabajar" : r.estado === "urgente" ? "Urgente" : "Revisar"}: ${r.resumen}`.slice(0, 160)] as [string, string]];
      });
      const pending = st.pending.filter((p) => p.estado === "pendiente").length;
      if (pending) alertas.unshift(["Por aprobar", `${pending} movimiento${pending > 1 ? "s" : ""} propuesto${pending > 1 ? "s" : ""} esperando tu OK en la Oficina`]);
      if (to) await sendEmail(officeEmail(to, { resumen: brief.resumen, prioridades: brief.prioridades ?? [], informe: brief.informe, estado: brief.estado, alertas }));
    }
    return NextResponse.json({ ok: true, ran });
  } catch (err) {
    await logError({ area: "cron", message: `Oficina: ${err instanceof Error ? err.message : String(err)}` }).catch(() => {});
    return NextResponse.json({ error: "La oficina no pudo trabajar hoy." }, { status: 500 });
  }
}
