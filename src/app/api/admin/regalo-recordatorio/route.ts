import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { enviarRecordatorios, pendientes } from "@/lib/regalo-recordatorio";
import { emailConfigured } from "@/lib/providers/email";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Owner only. GET: who hasn't used their gift yet. POST: send them «Tu anuncio de regalo te está esperando» now
// (once each; the daily round sends it by itself a day after signing up).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const list = await pendientes(0).catch(() => []);
  return NextResponse.json({ cuantos: list.length, correos: list.map((p) => p.email) });
}

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!emailConfigured()) return NextResponse.json({ error: "Los correos no están configurados (falta RESEND_API_KEY)." }, { status: 503 });
  const r = await enviarRecordatorios(0);
  return NextResponse.json({ ok: true, ...r });
}
