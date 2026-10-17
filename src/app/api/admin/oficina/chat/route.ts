import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { chat, clearChat, findAgent, loadChat, loadState } from "@/lib/oficina";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Owner only. The chat with one agent. GET ?agent=id: the conversation. POST {agent, text}: write to it
// (it answers with its data, its last report and the conversation so far). DELETE {agent}: start over.
const no = () => NextResponse.json({ error: "No autorizado." }, { status: 401 });
const known = async (id: string) => Boolean(findAgent(await loadState(), id));

export async function GET(req: Request) {
  if (!(await isAdmin())) return no();
  const id = new URL(req.url).searchParams.get("agent") ?? "";
  if (!(await known(id))) return NextResponse.json({ error: "Agente desconocido." }, { status: 400 });
  return NextResponse.json({ msgs: await loadChat(id) });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return no();
  const b = await req.json().catch(() => null);
  const id = String(b?.agent ?? "");
  const text = String(b?.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });
  if (text.length > 4000) return NextResponse.json({ error: "El mensaje es muy largo (máximo 4.000 caracteres)." }, { status: 400 });
  try {
    if (!(await known(id))) return NextResponse.json({ error: "Agente desconocido." }, { status: 400 });
    return NextResponse.json({ msgs: await chat(id, text) });
  } catch (e) {
    console.error("oficina chat", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo guardar la conversación. Prueba de nuevo." }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  if (!(await isAdmin())) return no();
  const b = await req.json().catch(() => null);
  const id = String(b?.agent ?? "");
  if (!(await known(id))) return NextResponse.json({ error: "Agente desconocido." }, { status: 400 });
  await clearChat(id);
  return NextResponse.json({ msgs: [] });
}
