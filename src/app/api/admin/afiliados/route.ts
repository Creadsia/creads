import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { listAfiliados, registrarPago, resumenDe, setEstado } from "@/lib/afiliados";
import { affiliateApprovedEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/providers/email";
import { type EstadoAfiliado, METODO_LABEL, PROGRAMA, pagables, toCsv } from "@/lib/afiliados-calc";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ESTADOS: EstadoAfiliado[] = ["pendiente", "activo", "pausado", "rechazado"];

// Panel interno → Afiliados (owner and partners).
// GET → every affiliate with their numbers and the program totals.
// GET ?csv=1&hasta=<ISO> → the payout list (who to pay, how much, where), only balances from US$50.
// POST {accion:"estado", code, estado, notas?} → approve / pause / reactivate / reject.
// POST {accion:"pagado", code, hasta} → marks as paid what was payable at `hasta` (the time of the list).
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const url = new URL(req.url);
  const hastaQ = Date.parse(url.searchParams.get("hasta") ?? "");
  const hasta = Number.isFinite(hastaQ) ? Math.min(hastaQ, Date.now()) : Date.now();
  try {
    const all = await listAfiliados();
    const rows = await Promise.all(all.map(async (a) => ({ a, r: await resumenDe(a, hasta) })));
    if (url.searchParams.get("csv") === "1") {
      const head = ["codigo", "nombre", "correo_cuenta", "metodo", "titular", "correo_pago", "pais", "banco", "tipo_cuenta", "cuenta", "id_fiscal", "swift", "monto_usd", "comisiones", "hasta", "notas_pago"];
      const lines = rows
        .filter(({ r }) => r.pagable >= PROGRAMA.minimoUsd)
        .map(({ a, r }) => {
          const p = a.pago;
          return [a.code, a.name, a.email, p ? METODO_LABEL[p.metodo] : "FALTAN DATOS", p?.titular, p?.correo, p?.pais, p?.banco, p?.tipoCuenta, p?.cuenta, p?.idFiscal, p?.swift, r.pagable.toFixed(2), pagables(r.libro.comisiones, hasta).length, new Date(hasta).toISOString(), p?.notas];
        });
      return new NextResponse(toCsv([head, ...lines]), {
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="pagos-afiliados-${new Date(hasta).toISOString().slice(0, 10)}.csv"`, "cache-control": "no-store" },
      });
    }
    const afiliados = rows.map(({ a, r }) => {
      const { libro, clicsDias, ...nums } = r;
      void clicsDias;
      return { ...a, numeros: nums, referidos: libro.referidos.slice(-200).reverse(), comisiones: libro.comisiones.slice(-300).reverse() };
    });
    const sum = (k: "pendiente" | "pagable" | "pagado" | "revertido" | "mrr" | "clics" | "registros" | "pagando") => Math.round(rows.reduce((s, { r }) => s + r[k], 0) * 100) / 100;
    const totales = {
      afiliados: all.length, activos: all.filter((a) => a.estado === "activo").length, pendientes: all.filter((a) => a.estado === "pendiente").length,
      clics: sum("clics"), registros: sum("registros"), pagando: sum("pagando"), mrr: sum("mrr"),
      pendiente: sum("pendiente"), pagable: sum("pagable"), pagado: sum("pagado"), revertido: sum("revertido"),
      aPagar: Math.round(rows.filter(({ r }) => r.pagable >= PROGRAMA.minimoUsd).reduce((s, { r }) => s + r.pagable, 0) * 100) / 100,
    };
    return NextResponse.json({ programa: PROGRAMA, hasta: new Date(hasta).toISOString(), totales, afiliados });
  } catch (e) {
    console.error("admin afiliados", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudieron leer los afiliados." }, { status: 502 });
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => null);
  const code = String(b?.code ?? "");
  try {
    if (b?.accion === "estado") {
      const estado = ESTADOS.find((e) => e === b.estado);
      if (!estado) return NextResponse.json({ error: "Estado desconocido." }, { status: 400 });
      const before = (await listAfiliados()).find((x) => x.code === code);
      const a = await setEstado(code, estado, typeof b.notas === "string" ? b.notas : undefined);
      // first approval: the affiliate gets their link and code by email
      if (a && estado === "activo" && before && !before.aprobado) await sendEmail(affiliateApprovedEmail(a.email, a.name, a.code)).catch(() => false);
      return a ? NextResponse.json({ ok: true, estado: a.estado }) : NextResponse.json({ error: "Afiliado no encontrado." }, { status: 404 });
    }
    if (b?.accion === "pagado") {
      const hasta = Date.parse(String(b.hasta ?? ""));
      if (!Number.isFinite(hasta)) return NextResponse.json({ error: "Falta la fecha de la lista de pagos." }, { status: 400 });
      const r = await registrarPago(code, hasta);
      if (!r.n) return NextResponse.json({ error: "No hay nada por pagar a este afiliado." }, { status: 400 });
      return NextResponse.json({ ok: true, ...r });
    }
    return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  } catch (e) {
    console.error("admin afiliados POST", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "No se pudo guardar." }, { status: 502 });
  }
}
