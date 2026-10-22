import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { phoneAlert, phoneCfg, setPhone } from "@/lib/phone-alert";

export const dynamic = "force-dynamic";

// Owner only: the phone alerts (see lib/phone-alert.ts). GET → state; POST {on} | {probar: true} | {nuevo: true}.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json(await phoneCfg());
}
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (b?.probar) {
    const ok = await phoneAlert({ title: "💰 ¡Nueva venta! (prueba)", text: "Así va a sonar tu celular cuando alguien compre en Creads.", priority: 5 }, true);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "No se pudo enviar. Activa primero los avisos." }, { status: 502 });
  }
  return NextResponse.json(await setPhone(b?.on !== false, b?.nuevo === true));
}
