import { after, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runGuardian, type GuardState } from "@/lib/guardian";
import { once } from "@/lib/marketing";
import { AREAS } from "@/lib/areas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// The Guardián's round, called every few minutes by an outside monitor (UptimeRobot):
//   https://www.creadsia.com/api/guardian?t=<GUARDIAN_TOKEN>
// or by Vercel with CRON_SECRET. Answers plain text: «OK …» when everything is fine, «ALERTA …» when
// there's an open critical problem (a monitor watching for the word «OK» then alerts too).

const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.byteLength === y.byteLength && timingSafeEqual(x, y); };
function authorized(req: Request) {
  const token = (process.env.GUARDIAN_TOKEN ?? "").trim();
  const got = new URL(req.url).searchParams.get("t") ?? "";
  if (token.length >= 24 && same(got, token)) return true;
  const cron = (process.env.CRON_SECRET ?? "").trim();
  return cron.length >= 16 && same(req.headers.get("authorization") ?? "", `Bearer ${cron}`);
}

/** A new critical problem: the agent in charge of that area looks at it right away (at most every 3 h per area). */
function wakeAreaAgents(st: GuardState) {
  const fresh = st.incidents.filter((i) => i.abierto && i.severidad === "critico" && i.first === st.lastRun);
  const areas = [...new Set(fresh.map((i) => i.area))];
  if (!areas.length) return;
  after(async () => {
    const { runOne } = await import("@/lib/oficina");
    for (const area of areas) {
      const head = AREAS.find((a) => a.id === area)?.agents[0] ?? "general";
      if (await once(`guardian:agente:${head}`, 3 * 3600)) await runOne(head).catch(() => {});
    }
  });
}

export async function GET(req: Request) {
  if (!authorized(req)) return new NextResponse("No autorizado.", { status: 401 });
  try {
    const st = await runGuardian();
    if (!st.skipped) wakeAreaAgents(st);
    // customers whose generations failed get an email first (and the owner a case to follow up)
    after(async () => { const { careSweep } = await import("@/lib/cuidado"); await careSweep().catch((e) => console.error("cuidado", e instanceof Error ? e.message : e)); });
    // the automatic video producer moves forward (its own request, its own time)
    after(async () => { const { kickProduction } = await import("@/lib/autoprod"); await kickProduction(); });
    // the office's extra rounds of the day (Oficina → «Ritmo de trabajo»), riding on this 5-minute ping
    after(async () => {
      const { officeRoundDue, runAll, runMarketingRound } = await import("@/lib/oficina");
      const due = await officeRoundDue().catch(() => null);
      if (due === "todos") await runAll().catch((e) => console.error("oficina ronda", e instanceof Error ? e.message : e));
      else if (due === "marketing") await runMarketingRound().catch((e) => console.error("oficina ronda", e instanceof Error ? e.message : e));
    });
    const critical = st.incidents.filter((i) => i.abierto && i.severidad === "critico");
    const text = critical.length ? `ALERTA · ${critical.map((i) => i.titulo).join(" | ")}` : `OK · ${st.checks.filter((c) => c.estado === "ok").length}/${st.checks.length} controles bien`;
    return new NextResponse(text, { status: 200, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  } catch (e) {
    console.error("guardian", e instanceof Error ? e.message : e);
    return new NextResponse("ALERTA · el Guardián no pudo revisar", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
}
