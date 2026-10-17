import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { findUserByEmail, setTwoFactor, twoFactorOf, userFromRequest, verifyPassword } from "@/lib/auth";
import { tooMany } from "@/lib/rate";
import { newSecret, otpauthUrl, verifyCode } from "@/lib/totp";

export const dynamic = "force-dynamic";

// Two-step verification for your own account.
// GET → is it on? POST {action:"start", password} → secret + QR · {action:"confirm", code} → on ·
// {action:"off", password, code} → off.
export async function GET(req: Request) {
  const me = await userFromRequest(req);
  if (!me) return NextResponse.json({ error: "Tu sesión terminó. Vuelve a entrar." }, { status: 401 });
  try {
    const tf = await twoFactorOf(me.id);
    return NextResponse.json({ ready: tf !== null, on: Boolean(tf?.on) });
  } catch {
    return NextResponse.json({ error: "No se pudo revisar. Intenta de nuevo." }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const me = await userFromRequest(req);
  if (!me) return NextResponse.json({ error: "Tu sesión terminó. Vuelve a entrar." }, { status: 401 });
  const limited = await tooMany("twoFactor", me.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const action = String(b?.action ?? "");
  const tf = await twoFactorOf(me.id).catch(() => undefined);
  if (tf === undefined) return NextResponse.json({ error: "No se pudo revisar. Intenta de nuevo." }, { status: 502 });
  if (tf === null) return NextResponse.json({ error: "Esta opción se activa en los próximos días." }, { status: 503 });

  const passwordOk = async () => {
    const full = await findUserByEmail(me.email);
    return Boolean(full && (await verifyPassword(String(b?.password ?? ""), full.password_hash)));
  };

  if (action === "start") {
    if (tf.on) return NextResponse.json({ error: "Ya está activada." }, { status: 400 });
    if (!(await passwordOk())) return NextResponse.json({ error: "La clave no es correcta." }, { status: 400 });
    const secret = newSecret();
    await setTwoFactor(me.id, secret, false); // pending until the first code is confirmed
    const url = otpauthUrl(secret, me.email);
    const qr = await QRCode.toString(url, { type: "svg", margin: 1, width: 200, color: { dark: "#000000", light: "#ffffff" } });
    return NextResponse.json({ secret, qr });
  }
  if (action === "confirm") {
    if (!tf.secret || tf.on) return NextResponse.json({ error: "Primero empieza la activación." }, { status: 400 });
    if (!verifyCode(tf.secret, String(b?.code ?? ""))) return NextResponse.json({ error: "Código incorrecto. Revisa que la hora del teléfono esté bien." }, { status: 400 });
    await setTwoFactor(me.id, tf.secret, true);
    return NextResponse.json({ on: true });
  }
  if (action === "off") {
    if (!tf.on || !tf.secret) return NextResponse.json({ on: false });
    if (!(await passwordOk()) || !verifyCode(tf.secret, String(b?.code ?? ""))) return NextResponse.json({ error: "La clave o el código no son correctos." }, { status: 400 });
    await setTwoFactor(me.id, null, false);
    return NextResponse.json({ on: false });
  }
  return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
}
