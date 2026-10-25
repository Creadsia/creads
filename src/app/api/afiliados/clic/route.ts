import { NextResponse } from "next/server";
import { contarClic } from "@/lib/afiliados";
import { codeOk, normCode } from "@/lib/afiliados-calc";
import { allow, clientIp } from "@/lib/rate";

export const dynamic = "force-dynamic";

// POST {code}: a visit through an affiliate's link (anonymous; a few per connection a day count, no more).
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  const code = normCode(b?.code);
  if (!codeOk(code)) return new NextResponse(null, { status: 204 });
  if (!(await allow("refClick", `${clientIp(req)}:${code}`))) return new NextResponse(null, { status: 204 });
  await contarClic(code).catch((e) => console.error("afiliados: clic", e instanceof Error ? e.message : e));
  return new NextResponse(null, { status: 204 });
}
