import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { PAGES, liveNow } from "@/lib/presence";

export const dynamic = "force-dynamic";

// GET (owner only) → how many people have Creads open right now, by page.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const { total, byPage } = await liveNow();
    return NextResponse.json({ total, paginas: Object.entries(byPage).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, nombre: PAGES[k] ?? k, n })), at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ error: "No se pudo leer." }, { status: 502 });
  }
}
