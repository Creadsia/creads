import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { afiliadoDeUsuario, guardarDatosPago, postular, resumenDe } from "@/lib/afiliados";
import { type DatosPago, PROGRAMA, maskEmail } from "@/lib/afiliados-calc";
import { phoneAlert } from "@/lib/phone-alert";
import { allow } from "@/lib/rate";

export const dynamic = "force-dynamic";

const str = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);

// The signed-in person's affiliate page (/app/afiliados).
// GET → their application or affiliate account with its numbers.
// POST {accion:"postular", name, canal, web, mensaje, code?, acepta} → applies to the program.
// POST {accion:"pago", metodo, titular, correo, ...} → saves where to receive the money.
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  try {
    const a = await afiliadoDeUsuario(s.user.id);
    if (!a) return NextResponse.json({ programa: PROGRAMA, afiliado: null, user: { name: s.user.name ?? "", email: s.user.email } });
    const r = await resumenDe(a);
    const { libro, ...nums } = r;
    return NextResponse.json({
      programa: PROGRAMA,
      afiliado: { code: a.code, estado: a.estado, name: a.name, canal: a.canal, web: a.web, creado: a.creado, aprobado: a.aprobado, pago: a.pago ?? null },
      numeros: nums,
      // customers shown half-hidden: the affiliate recognises them, the full address stays private
      referidos: libro.referidos.slice(-100).reverse().map((x) => ({ email: maskEmail(x.email), at: x.at, via: x.via, meses: x.meses.length })),
      comisiones: libro.comisiones.slice(-200).reverse().map((c) => ({ id: c.id.replace(/^[a-z]+:/, "").slice(-6), at: c.at, label: c.label, meses: c.meses, baseUsd: c.baseUsd, pct: c.pct, usd: c.usd, estado: c.estado, pagadoEn: c.pagadoEn ?? null })),
    });
  } catch (e) {
    console.error("afiliados GET", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No pudimos cargar tu cuenta de afiliado. Intenta de nuevo en un momento." }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  if (!(await allow("afiliado", s.user.id))) return NextResponse.json({ error: "Demasiados intentos. Espera un rato y vuelve a probar." }, { status: 429 });
  const b = await req.json().catch(() => null);
  try {
    if (b?.accion === "postular") {
      if (b.acepta !== true) return NextResponse.json({ error: "Para postular tienes que aceptar los términos del programa." }, { status: 400 });
      const name = str(b.name, 80);
      if (name.length < 2) return NextResponse.json({ error: "Escribe tu nombre." }, { status: 400 });
      const canal = str(b.canal, 60);
      const web = str(b.web, 200);
      if (!web) return NextResponse.json({ error: "Cuéntanos dónde vas a promocionar Creads (tu web, redes o canal)." }, { status: 400 });
      const a = await postular(s.user, { name, canal, web, mensaje: str(b.mensaje, 600), code: str(b.code, 20) });
      if (a?.estado === "pendiente") await phoneAlert({ title: "🤝 Nueva postulación de afiliado", text: `${name} · ${canal} · ${web}`.slice(0, 200), priority: 3 }).catch(() => false);
      return NextResponse.json({ ok: true, code: a?.code, estado: a?.estado });
    }
    if (b?.accion === "pago") {
      const metodo = PROGRAMA.metodos.find((m) => m === b.metodo);
      if (!metodo) return NextResponse.json({ error: "Elige cómo quieres recibir tus pagos." }, { status: 400 });
      const pago: DatosPago = {
        metodo, titular: str(b.titular, 100), correo: str(b.correo, 200), pais: str(b.pais, 60), banco: str(b.banco, 100),
        tipoCuenta: str(b.tipoCuenta, 40), cuenta: str(b.cuenta, 60), idFiscal: str(b.idFiscal, 40), swift: str(b.swift, 20), notas: str(b.notas, 300),
      };
      if (pago.titular.length < 2) return NextResponse.json({ error: "Escribe el nombre del titular." }, { status: 400 });
      if ((metodo === "paypal" || metodo === "wise") && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(pago.correo ?? "")) return NextResponse.json({ error: `Escribe el correo de tu cuenta ${metodo === "paypal" ? "PayPal" : "Wise"}.` }, { status: 400 });
      if (metodo === "banco" && (!pago.banco || !pago.cuenta)) return NextResponse.json({ error: "Escribe el banco y el número de cuenta." }, { status: 400 });
      const ok = await guardarDatosPago(s.user.id, pago);
      if (!ok) return NextResponse.json({ error: "Primero postula al programa." }, { status: 400 });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/código/.test(msg)) return NextResponse.json({ error: msg }, { status: 400 });
    console.error("afiliados POST", msg);
    return NextResponse.json({ error: "No se pudo guardar. Intenta de nuevo en un momento." }, { status: 502 });
  }
}
