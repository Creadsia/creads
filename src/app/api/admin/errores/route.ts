import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { alarm, groupErrors, markResolved, recentErrors, resolvedSigs } from "@/lib/errlog";
import { genStats, watchFailures } from "@/lib/genstats";
import { emailConfigured } from "@/lib/providers/email";
import { sbRest } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Owner only. GET: errors of the last 7 days (grouped), generations of the last 24 h and 7 days,
// and whether alarms can reach the owner. POST {action:"resolver", sig} marks a kind of error as fixed;
// POST {action:"probar"} sends a test alarm.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const [list, resolved, g24, g7, owners] = await Promise.all([
    recentErrors(7), resolvedSigs(), genStats(24), genStats(24 * 7),
    sbRest<{ email: string }[]>("users?workspace=eq.main&role=eq.owner&active=eq.true&select=email&limit=1").catch(() => []),
  ]);
  void watchFailures();
  return NextResponse.json({ groups: groupErrors(list, resolved).slice(0, 100), g24, g7, alarms: { email: owners[0]?.email ?? null, ready: emailConfigured() } });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (b?.action === "resolver" && typeof b.sig === "string" && /^[0-9a-f]{12}$/.test(b.sig)) {
    await markResolved(b.sig);
    return NextResponse.json({ ok: true });
  }
  if (b?.action === "probar") {
    const sent = await alarm(`prueba:${Date.now()}`, { title: "Prueba de alarma", detail: "Si te llegó este correo, las alarmas de Creads funcionan. No tienes que hacer nada." });
    return NextResponse.json({ ok: sent, error: sent ? undefined : "No se pudo enviar. Revisa que RESEND_API_KEY esté en Vercel." });
  }
  return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
}
