import { NextResponse } from "next/server";
import { PLANS, clpFor } from "@/lib/catalog";
import { PRUEBA_DIAS } from "@/lib/regalo";
import { PRUEBA_PLAN } from "@/lib/prueba";
import { usdClpRate } from "@/lib/usd-clp";

// What the free trial costs after it ends, for the sign-up page's checkout summary (public).
export async function GET() {
  const plan = PLANS.find((p) => p.id === PRUEBA_PLAN)!;
  const rate = await usdClpRate().catch(() => 950);
  return NextResponse.json({ dias: PRUEBA_DIAS, plan: plan.name, clp: clpFor(plan.monthly, rate) }, { headers: { "cache-control": "public, s-maxage=1800" } });
}
