import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { orders, updateOrder } from "@/lib/billing";
import { cancelSubscription } from "@/lib/mercadopago";

export const dynamic = "force-dynamic";

// Stops the monthly renewal. The plan stays active until the date already paid.
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const sub = (await orders()).find((o) => o.ws === s.user.workspace && o.status === "pagado" && o.mp?.kind === "subscription" && !o.mp.cancelled);
  if (!sub?.mp) return NextResponse.json({ error: "No tienes una suscripción activa." }, { status: 404 });
  try {
    await cancelSubscription(sub.mp.id);
    await updateOrder(sub.id, (o) => { if (o.mp) o.mp.cancelled = true; });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo cancelar. Escríbenos a hola@creadsia.com." }, { status: 502 });
  }
}
