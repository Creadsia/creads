import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { cancelOrder, getOrder, orders } from "@/lib/billing";
import { CreditError } from "@/lib/credits";
import { settleOrder } from "@/lib/settle";

export const dynamic = "force-dynamic";

// Customers' orders (owner only): list them, and mark one paid by hand (transfer: gives the credits,
// moves the plan date and writes the income, once) or cancelled.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    return NextResponse.json({ orders: (await orders(100)).filter((o) => o.status !== "reemplazado") });
  } catch (err) {
    const missing = Boolean((err as { missing?: boolean })?.missing);
    return NextResponse.json({ orders: [], error: missing ? "Falta ejecutar supabase/billing.sql en Supabase." : undefined });
  }
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => null);
  const id = String(b?.id ?? "");
  const status = b?.status === "pagado" ? "pagado" : b?.status === "cancelado" ? "cancelado" : null;
  if (!status) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  try {
    const o = await getOrder(id);
    if (!o) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    if (status === "cancelado") return NextResponse.json({ order: await cancelOrder(id) });
    if (o.status === "pagado") return NextResponse.json({ error: "Ese pedido ya estaba pagado." }, { status: 409 });
    const r = await settleOrder(o.id, { id: o.id, amount: o.quote.total, currency: "USD" }, "manual");
    return NextResponse.json({ order: await getOrder(id), already: r.already ?? false });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo." }, { status: err instanceof CreditError ? err.status : 502 });
  }
}
