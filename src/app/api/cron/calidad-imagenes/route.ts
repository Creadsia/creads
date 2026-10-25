import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { correoSemanal, leerRegistros, resumirImagenes } from "@/lib/calidad-imagen";
import { ownerAddress } from "@/lib/errlog";
import { emailConfigured, sendEmail } from "@/lib/providers/email";
import { once } from "@/lib/marketing";

export const dynamic = "force-dynamic";

// Mondays (vercel.json → crons): the owner gets the week's image quality — «primer intento OK» per type of
// piece (goal 90%) and the reasons for redos. Once per week even if the cron fires twice.

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return secret.length >= 16 && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!emailConfigured()) return NextResponse.json({ ok: false, error: "Falta configurar el correo." });
  const to = await ownerAddress();
  if (!to) return NextResponse.json({ ok: false, error: "No hay dueño." });
  if (!(await once("correo-calidad-img", 6 * 86400)))return NextResponse.json({ ok: true, yaEnviado: true });
  const r = resumirImagenes(await leerRegistros(7), 7);
  const c = correoSemanal(r);
  const sent = await sendEmail({ to, subject: c.subject, html: c.html, text: c.text, tag: "calidad-imagenes" });
  return NextResponse.json({ ok: sent, piezas: r.total.piezas, tasa: r.total.tasa });
}
