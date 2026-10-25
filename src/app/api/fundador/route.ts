import { NextResponse } from "next/server";
import { fundadoresUsados } from "@/lib/billing";
import { FUNDADOR } from "@/lib/catalog";

export const revalidate = 300;

// Public: how many founder places are left (Escala at US$49 for 3 months, first 50 customers). Real count.
export async function GET() {
  const usados = await fundadoresUsados().catch(() => null);
  return NextResponse.json({ cupos: FUNDADOR.cupos, quedan: usados == null ? null : Math.max(0, FUNDADOR.cupos - usados) });
}
