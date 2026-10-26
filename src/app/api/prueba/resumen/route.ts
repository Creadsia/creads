import { NextResponse } from "next/server";
import { clpFor } from "@/lib/catalog";
import { resumenPrueba } from "@/lib/prueba";
import { usdClpRate } from "@/lib/usd-clp";

// What the free trial gives and costs after it ends, for the sign-up page's checkout summary (public): days, gift
// credits, the plan (Testea), its price in US$ and credits a month, and the pesos Mercado Pago will charge.
export async function GET() {
  const rate = await usdClpRate().catch(() => 950);
  const r = resumenPrueba();
  return NextResponse.json({ ...r, clp: clpFor(r.usd, rate) }, { headers: { "cache-control": "public, s-maxage=1800" } });
}
