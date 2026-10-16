import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/admin";
import { WORKSPACE_RE } from "@/lib/db";
import { CreditError, balanceOf, grant, history } from "@/lib/credits";
import { recordPlanPayment, workspaceRow } from "@/lib/billing";

export const dynamic = "force-dynamic";

// The owner's billing desk for one customer: balance and movements (GET ?ws=), and
// POST {ws, action: "pago" | "agregar" | "quitar", plan?, months?, credits?, note?, ingreso?}.
// "pago" records a payment by hand: adds the plan's credits, moves the paid-until date and (if asked)
// writes the income in the finance book.

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const fail = (err: unknown) => {
  const missing = Boolean((err as { missing?: boolean })?.missing);
  return bad(missing ? "Falta activar los créditos: ejecuta supabase/billing.sql en Supabase." : err instanceof Error ? err.message : "No se pudo.", err instanceof CreditError ? err.status : 502);
};

export async function GET(req: Request) {
  if (!(await isAdmin())) return bad("No autorizado.", 401);
  const ws = new URL(req.url).searchParams.get("ws") ?? "";
  if (!WORKSPACE_RE.test(ws) || ws === "main") return bad("Cliente inválido.");
  try {
    const [balance, moves] = await Promise.all([balanceOf(ws), history(ws, 40)]);
    return NextResponse.json({ balance, history: moves });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return bad("No autorizado.", 401);
  const me = await currentUser();
  const b = await req.json().catch(() => null);
  const ws = String(b?.ws ?? "");
  if (!WORKSPACE_RE.test(ws) || ws === "main") return bad("Cliente inválido.");
  const action = String(b?.action ?? "");
  const note = String(b?.note ?? "").trim().slice(0, 150);
  try {
    await workspaceRow(ws); // must exist

    if (action === "agregar" || action === "quitar") {
      const n = Math.round(Number(b?.credits));
      if (!(n > 0) || n > 1_000_000) return bad("Escribe cuántos créditos.");
      await grant(ws, action === "agregar" ? n : -n, action === "agregar" ? "topup" : "adjust", note || (action === "agregar" ? "Créditos agregados" : "Créditos quitados"), me?.email ?? "dueño");
    } else if (action === "pago") {
      await recordPlanPayment(ws, String(b?.plan ?? ""), Number(b?.months) || 1, {
        note, by: me?.email ?? "dueño",
        amount: b?.ingreso === false ? null : Number(b?.amount) > 0 ? Number(b.amount) : undefined,
        currency: b?.currency === "CLP" ? "CLP" : "USD",
      });
    } else {
      return bad("Acción desconocida.");
    }
    const [balance, moves] = await Promise.all([balanceOf(ws), history(ws, 40)]);
    return NextResponse.json({ balance, history: moves });
  } catch (err) {
    return fail(err);
  }
}
