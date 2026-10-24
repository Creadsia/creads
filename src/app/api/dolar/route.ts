import { NextResponse } from "next/server";
import { usdClpRate } from "@/lib/usd-clp";

// The rate prices in pesos are shown with (the same one Mercado Pago charges with). Public, cached.
export async function GET() {
  const usdClp = await usdClpRate().catch(() => 950);
  return NextResponse.json({ usdClp }, { headers: { "cache-control": "public, s-maxage=1800, stale-while-revalidate=3600" } });
}
