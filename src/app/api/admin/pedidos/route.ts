import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/admin";
import { orders, recordIncome, recordPlanPayment, setOrderStatus } from "@/lib/billing";
import { PACKS } from "@/lib/catalog";
import { CreditError, grant } from "@/lib/credits";
import { sendMeta } from "@/lib/meta";

export const dynamic = "force-dynamic";

// Customers' orders (owner only): list them, and mark one paid (gives the credits, moves the plan date
// and writes the income) or cancelled.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ orders: (await orders()).slice(0, 100) });
}

export async function PATCH(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const me = await currentUser();
  const b = await req.json().catch(() => null);
  const id = String(b?.id ?? "");
  const status = b?.status === "pagado" ? "pagado" : b?.status === "cancelado" ? "cancelado" : null;
  if (!status) return NextResponse.json({ error: "Estado inválido." }, { status: 400 });
  try {
    const o = (await orders()).find((x) => x.id === id);
    if (!o) return NextResponse.json({ error: "Pedido no encontrado." }, { status: 404 });
    if (o.status !== "pendiente") return NextResponse.json({ error: "Ese pedido ya estaba cerrado." }, { status: 409 });
    if (status === "pagado") {
      const by = me?.email ?? "dueño";
      const pack = PACKS.find((p) => p.id === o.item);
      if (pack) {
        await grant(o.ws, pack.credits, "topup", `Compra ${pack.credits.toLocaleString("es-CL")} créditos · ${o.id}`, by);
        await recordIncome(o.wsName, `${pack.credits.toLocaleString("es-CL")} créditos extra · ${o.id}`, o.quote.total);
      } else {
        await recordPlanPayment(o.ws, o.item, o.period === "anual" ? 12 : 1, { note: o.id, amount: o.quote.total, by });
      }
    }
    const closed = await setOrderStatus(id, status);
    // Meta "Purchase", from the server (the customer's browser isn't involved when you confirm by hand)
    if (status === "pagado" && o.visitor) {
      await sendMeta({ name: "Purchase", eventId: `buy-${o.id}`, email: o.email, value: o.quote.total, currency: "USD", content: o.quote.label }, { ...o.visitor, url: "https://www.creadsia.com/app/planes" });
    }
    return NextResponse.json({ order: closed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo." }, { status: err instanceof CreditError ? err.status : 502 });
  }
}
