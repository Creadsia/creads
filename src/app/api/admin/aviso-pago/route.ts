import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { enviarAvisoPago, pendientesPago } from "@/lib/aviso-pago";
import { emailConfigured } from "@/lib/providers/email";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Owner only. GET: who opened the payment while it was broken and couldn't finish. POST: email them «ya está
// solucionado, vuelve a intentar» now (once each).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const list = await pendientesPago().catch(() => []);
  return NextResponse.json({ cuantos: list.length, correos: list.map((p) => p.email) });
}

export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!emailConfigured()) return NextResponse.json({ error: "Los correos no están configurados (falta RESEND_API_KEY)." }, { status: 503 });
  const r = await enviarAvisoPago();
  return NextResponse.json({ ok: true, ...r });
}
