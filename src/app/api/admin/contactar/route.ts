import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { casos, marcarCaso } from "@/lib/cuidado";

export const dynamic = "force-dynamic";

// Clientes → Clientes a contactar: customers whose generations failed or who asked for a person.
// GET → cases of the last 30 days. PATCH {id, estado: "contactado"|"pendiente", nota?}.
const no = () => NextResponse.json({ error: "No autorizado." }, { status: 401 });

export async function GET() {
  if (!(await isAdmin())) return no();
  return NextResponse.json({ casos: await casos(), whatsapp: (process.env.NEXT_PUBLIC_WHATSAPP ?? "").replace(/\D/g, "") });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return no();
  const b = await req.json().catch(() => null);
  if (typeof b?.id !== "string" || !["contactado", "pendiente"].includes(b?.estado)) return NextResponse.json({ error: "Falta el caso." }, { status: 400 });
  const ok = await marcarCaso(b.id, b.estado, typeof b.nota === "string" ? b.nota : undefined);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No encontré ese caso." }, { status: 404 });
}
