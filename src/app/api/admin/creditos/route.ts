import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/admin";
import { WORKSPACE_RE } from "@/lib/db";
import { CreditError, balanceOf, grant, history } from "@/lib/credits";
import { DEFAULT_FINANZAS, type Finanzas } from "@/lib/finance";
import { readPrivateJSON, sbRest, writePrivateJSON } from "@/lib/supabase";
import { forgetWorkspace } from "@/lib/auth";

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

const addMonths = (iso: string, months: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) d.setUTCDate(0); // 31 Jan + 1 month = 28/29 Feb
  return d.toISOString().slice(0, 10);
};

export async function POST(req: Request) {
  if (!(await isAdmin())) return bad("No autorizado.", 401);
  const me = await currentUser();
  const b = await req.json().catch(() => null);
  const ws = String(b?.ws ?? "");
  if (!WORKSPACE_RE.test(ws) || ws === "main") return bad("Cliente inválido.");
  const action = String(b?.action ?? "");
  const note = String(b?.note ?? "").trim().slice(0, 150);
  try {
    const rows = await sbRest<{ id: string; name: string; plan: string | null; paid_until: string | null; discount: number }[]>(
      `workspaces?id=eq.${encodeURIComponent(ws)}&select=id,name,plan,paid_until,discount&limit=1`,
    );
    const w = rows[0];
    if (!w) return bad("Cliente no encontrado.", 404);

    if (action === "agregar" || action === "quitar") {
      const n = Math.round(Number(b?.credits));
      if (!(n > 0) || n > 1_000_000) return bad("Escribe cuántos créditos.");
      await grant(ws, action === "agregar" ? n : -n, action === "agregar" ? "topup" : "adjust", note || (action === "agregar" ? "Créditos agregados" : "Créditos quitados"), me?.email ?? "dueño");
    } else if (action === "pago") {
      const book = (await readPrivateJSON<Finanzas>("finanzas.json").catch(() => null)) ?? DEFAULT_FINANZAS;
      const plan = book.config.planes.find((p) => p.id === b?.plan);
      if (!plan) return bad("Elige un plan.");
      const months = Math.min(12, Math.max(1, Math.round(Number(b?.months) || 1)));
      const yearly = months === 12;
      const today = new Date().toISOString().slice(0, 10);
      const from = w.paid_until && w.paid_until > today ? w.paid_until : today;
      const until = addMonths(from, months);
      await grant(ws, plan.creditos * months, "plan", `Pago plan ${plan.nombre} · ${months === 1 ? "1 mes" : `${months} meses`}${note ? ` · ${note}` : ""}`, me?.email ?? "dueño");
      await sbRest(`workspaces?id=eq.${encodeURIComponent(ws)}`, { method: "PATCH", body: JSON.stringify({ plan: plan.nombre, paid_until: until }) });
      forgetWorkspace(ws);
      // write the income in the finance book (amount after the customer's discount)
      if (b?.ingreso !== false) {
        const price = (yearly ? plan.anual * 12 : plan.mensual * months) * (1 - Number(w.discount ?? 0) / 100);
        const amount = Number(b?.amount) > 0 ? Number(b.amount) : +price.toFixed(2);
        const currency = b?.currency === "CLP" ? "CLP" : "USD";
        book.movimientos.unshift({
          id: `pago-${ws}-${Date.now()}`, fecha: today, tipo: "ingreso", servicio: w.name,
          detalle: `Plan ${plan.nombre} · ${months === 1 ? "1 mes" : `${months} meses`}${note ? ` · ${note}` : ""}`, monto: amount, moneda: currency,
        });
        await writePrivateJSON("finanzas.json", { ...book, actualizado: new Date().toISOString() });
      }
    } else {
      return bad("Acción desconocida.");
    }
    const [balance, moves] = await Promise.all([balanceOf(ws), history(ws, 40)]);
    return NextResponse.json({ balance, history: moves });
  } catch (err) {
    return fail(err);
  }
}
