import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { cleanTurns } from "@/lib/assistant";
import { guardarCaso } from "@/lib/cuidado";
import { alarm } from "@/lib/errlog";
import { oneLine, sendWhatsApp } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

// «Hablar con una persona» from the help chat: the case goes to the owner (Panel → Clientes a contactar,
// Telegram and email) with the conversation, and the customer gets a clear promise.
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("human", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const turns = cleanTurns(b?.messages).slice(-6);
  const page = typeof b?.page === "string" && /^\/[\w/-]{0,60}$/.test(b.page) ? b.page : "/app";
  const last = [...turns].reverse().find((t) => t.role === "user")?.content ?? "(sin mensaje: pidió hablar con una persona)";
  const nota = turns.map((t) => `${t.role === "user" ? "Cliente" : "Asistente"}: ${t.content.slice(0, 300)}`).join("\n").slice(0, 1500);
  const at = new Date().toISOString();
  await guardarCaso({ id: `ayuda:${s.user.workspace}:${Date.now().toString(36)}`, ws: s.user.workspace, email: s.user.email, name: s.user.name, items: [{ what: last.slice(0, 160), href: page }], at, estado: "pendiente", motivo: "ayuda", nota });
  await sendWhatsApp(oneLine(`🙋 ${s.user.name || s.user.email} pide hablar con una persona en Creads: «${last.slice(0, 200)}». Escríbele a ${s.user.email} (Panel → Clientes a contactar).`)).catch(() => null);
  await alarm(`persona:${s.user.id}:${at.slice(0, 13)}`, { title: "Un cliente pide hablar con una persona", detail: `${s.user.name || s.user.email} (${s.user.email}) escribió en el chat de ayuda: «${last.slice(0, 300)}». Respóndele por correo; el caso está en Panel → Clientes → Clientes a contactar.` }).catch(() => false);
  return NextResponse.json({ ok: true, mensaje: `Listo. Una persona del equipo de Creads te va a escribir a ${s.user.email}. Normalmente respondemos en pocas horas (en horario de Chile).` });
}
