import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getOrder } from "@/lib/billing";
import { diagnosticoPago, mpReady } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

// «¿Por qué no pagó?» (owner's plan P0, 25 Oct 2026): asks Mercado Pago, read-only, what happened with an
// unpaid checkout — rejected (with the bank's reason), abandoned (never tried) or still pending.
export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!mpReady()) return NextResponse.json({ error: "Mercado Pago no está conectado." }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const o = await getOrder(id).catch(() => null);
  if (!o) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
  if (!o.mp?.id) return NextResponse.json({ resumen: "Este pedido no pasó por Mercado Pago (transferencia o pago a mano).", intentos: [] });
  try {
    return NextResponse.json(await diagnosticoPago({ orderId: o.id, kind: o.mp.kind, id: o.mp.id }));
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo consultar Mercado Pago." }, { status: 502 });
  }
}
