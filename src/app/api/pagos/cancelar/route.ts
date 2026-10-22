import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { ordersOf, setOrderMp } from "@/lib/billing";
import { cancelSubscription } from "@/lib/mercadopago";
import { updatePrivateJSON } from "@/lib/supabase";
import { creditStatus } from "@/lib/credits";
import { cancelEmail } from "@/lib/emails";
import { sendEmail } from "@/lib/providers/email";
import { PLANS } from "@/lib/catalog";

const LEAVE_REASONS = ["Es muy caro", "No lo estoy usando", "La calidad no me convenció", "Me faltó una función", "Era solo para probar", "Otro"];
interface Leave { ws: string; at: string; reason: string; detail: string }

export const dynamic = "force-dynamic";

// Stops the monthly renewal. The plan stays active until the date already paid. The reason the
// customer gives is kept for the owner (morning summary): it's how we learn why people leave.
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const b = await req.json().catch(() => null);
  const reason = LEAVE_REASONS.includes(b?.reason) ? String(b.reason) : "Sin motivo";
  const detail = String(b?.detail ?? "").trim().slice(0, 500);
  const sub = (await ordersOf(s.user.workspace)).find((o) => o.status === "pagado" && o.mp?.kind === "subscription" && !o.mp.cancelled);
  if (!sub?.mp) return NextResponse.json({ error: "No tienes una suscripción activa." }, { status: 404 });
  try {
    await cancelSubscription(sub.mp.id);
    await setOrderMp(sub.id, { ...sub.mp, cancelled: true });
    try {
      await updatePrivateJSON<Leave[]>("cancelaciones.json", (cur) => [...(cur ?? []), { ws: s.user.workspace, at: new Date().toISOString(), reason, detail }].slice(-500));
    } catch (e) {
      console.error("cancel reason", e instanceof Error ? e.message : e);
    }
    // a clear confirmation: until when the plan still works, and that nothing more is charged
    try {
      const st = await creditStatus(s.user.workspace);
      const plan = PLANS.find((p) => p.id === st.plan)?.name ?? null;
      await sendEmail(cancelEmail(s.user.email, s.user.name ?? null, { plan, until: st.paidUntil ?? null }));
    } catch (e) {
      console.error("cancel email", e instanceof Error ? e.message : e);
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "No se pudo cancelar. Escríbenos a hola@creadsia.com." }, { status: 502 });
  }
}
