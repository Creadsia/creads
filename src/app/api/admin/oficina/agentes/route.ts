import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { BUILTIN_IDS, MAX_CUSTOM, SAFE_ID, cleanAgent, clearChat, commit, loadState, newAgentId, officeView } from "@/lib/oficina";

export const dynamic = "force-dynamic";

// Owner only. Agents the owner creates. POST {name, area, mission, search, sharePct, sources}: new agent.
// PUT {id, ...same}: edit one. DELETE {id}: remove one (its reports and chat go with it).
const no = () => NextResponse.json({ error: "No autorizado." }, { status: 401 });
const bad = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function POST(req: Request) {
  if (!(await isAdmin())) return no();
  const a = cleanAgent(await req.json().catch(() => null));
  if (typeof a === "string") return bad(a);
  const st = await loadState();
  if (Object.keys(st.custom).length >= MAX_CUSTOM) return bad(`Puedes tener hasta ${MAX_CUSTOM} agentes propios. Elimina uno para crear otro.`);
  const id = newAgentId(st, a.name);
  await commit((s) => { s.custom[id] = a; s.agents[id] = { on: true }; });
  return NextResponse.json({ ...(await officeView()), created: id });
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return no();
  const b = await req.json().catch(() => null);
  const id = String(b?.id ?? "");
  const a = cleanAgent(b);
  if (typeof a === "string") return bad(a);
  const st = await loadState();
  if (!st.custom[id]) return bad("Ese agente no existe (o es de los que vienen con la oficina).");
  await commit((s) => { if (s.custom[id]) s.custom[id] = a; });
  return NextResponse.json(await officeView());
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return no();
  const b = await req.json().catch(() => null);
  const id = String(b?.id ?? "");
  if (BUILTIN_IDS.includes(id)) return bad("Los agentes que vienen con la oficina no se eliminan: puedes apagarlos.");
  if (!SAFE_ID.test(id) || !(await loadState()).custom[id]) return bad("Ese agente no existe.");
  await commit((s) => { delete s.custom[id]; delete s.agents[id]; delete s.last[id]; delete s.history[id]; delete s.tasks[id]; });
  await clearChat(id).catch(() => {});
  return NextResponse.json(await officeView());
}
