import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { BUILTIN_IDS, commit, decide, dismiss, findAgent, markEncargo, loadState, officeView, runAll, runDirectors, runOne, runTeam, saveMemory } from "@/lib/oficina";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Owner only. GET: the office (agents, last reports, month's spend, memory). POST {agent: id | "todos"}:
// make an agent (or the whole office) work now. PATCH {on?, budgetUsd?, agent?, agentOn?, mission?, memoria?} | {decide, aprobar} (a proposed move)
// | {encargo, estado} (an assignment for Claude copied by hand).
const no = () => NextResponse.json({ error: "No autorizado." }, { status: 401 });
const fail = (err: unknown) => {
  console.error("oficina", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "No se pudo leer o guardar la oficina. Prueba de nuevo en un rato." }, { status: 502 });
};

export async function GET() {
  if (!(await isAdmin())) return no();
  try { return NextResponse.json(await officeView()); } catch (e) { return fail(e); }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return no();
  const b = await req.json().catch(() => null);
  const agent = String(b?.agent ?? "");
  try {
    const st = await loadState();
    if (agent === "todos") {
      if (!st.on) return NextResponse.json({ error: "La oficina está apagada: enciéndela primero." }, { status: 400 });
      await runAll();
    } else if (agent === "directores") {
      if (!st.on) return NextResponse.json({ error: "La oficina está apagada: enciéndela primero." }, { status: 400 });
      await runDirectors();
    } else if (agent === "equipo") {
      if (!st.on) return NextResponse.json({ error: "La oficina está apagada: enciéndela primero." }, { status: 400 });
      await runTeam();
    } else if (findAgent(st, agent)) await runOne(agent);
    else return NextResponse.json({ error: "Agente desconocido." }, { status: 400 });
    return NextResponse.json(await officeView());
  } catch (e) { return fail(e); }
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return no();
  const b = await req.json().catch(() => null);
  if (b?.budgetUsd !== undefined) {
    const n = Number(b.budgetUsd);
    if (!Number.isFinite(n) || n < 0 || n > 1000) return NextResponse.json({ error: "El tope debe ser entre US$0 y US$1.000 al mes." }, { status: 400 });
  }
  if (typeof b?.mission === "string" && b.mission.trim().length < 20) return NextResponse.json({ error: "Las instrucciones son muy cortas: escribe al menos una oración." }, { status: 400 });
  try {
    if (typeof b?.memoria === "string") await saveMemory(b.memoria);
    if (typeof b?.dismiss === "string") { await dismiss(b.dismiss); return NextResponse.json(await officeView()); }
    if (typeof b?.decide === "string" && typeof b.aprobar === "boolean") {
      const r = await decide(b.decide, b.aprobar);
      if (!r.ok) return NextResponse.json({ error: r.mensaje }, { status: 409 });
      return NextResponse.json({ ...(await officeView()), mensaje: r.mensaje });
    }
    if (typeof b?.encargo === "string" && ["por enviar", "enviado", "en curso", "listo"].includes(b.estado)) {
      await markEncargo(b.encargo, b.estado);
      return NextResponse.json(await officeView());
    }
    await commit((s) => {
      if (typeof b?.on === "boolean") s.on = b.on;
      if (b?.engine === "claude" || b?.engine === "grok") s.engine = b.engine;
      if (b?.budgetUsd !== undefined) s.budgetUsd = Math.round(Number(b.budgetUsd) * 100) / 100;
      const id = typeof b?.agent === "string" ? b.agent : "";
      if (id && findAgent(s, id)) {
        if (typeof b.agentOn === "boolean") s.agents[id] = { on: b.agentOn };
        if (typeof b.mission === "string" && BUILTIN_IDS.includes(id)) s.missions[id] = b.mission.trim().slice(0, 4000);
        if (b.mission === null && BUILTIN_IDS.includes(id)) delete s.missions[id]; // back to the original instructions
      }
    });
    return NextResponse.json(await officeView());
  } catch (e) { return fail(e); }
}
