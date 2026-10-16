import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { DEFAULT_FINANZAS, type Finanzas } from "@/lib/finance";
import { readPrivateJSON, writePrivateJSON } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const FILE = "finanzas.json";

// The finance book lives as one private JSON file in Supabase storage (owner only).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const data = (await readPrivateJSON<Finanzas>(FILE)) ?? DEFAULT_FINANZAS;
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo leer." }, { status: 502 });
  }
}

export async function PUT(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as Finanzas | null;
  const ok =
    body &&
    Array.isArray(body.movimientos) &&
    Array.isArray(body.fijos) &&
    Array.isArray(body.modelos) &&
    Array.isArray(body.cuentas) &&
    typeof body.config === "object";
  if (!ok) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  if (JSON.stringify(body).length > 2_000_000) return NextResponse.json({ error: "Demasiados datos." }, { status: 413 });

  // Safety net: refuse anything that looks like an API key, so secrets never land in this file.
  if (/\b(sk-ant-|sb_secret_|AIza[0-9A-Za-z_-]{20}|sk_live_|eyJhbGci)/.test(JSON.stringify(body))) {
    return NextResponse.json({ error: "Eso parece una clave secreta. Las claves van solo en Vercel." }, { status: 400 });
  }
  try {
    const actualizado = new Date().toISOString();
    await writePrivateJSON(FILE, { ...body, actualizado });
    return NextResponse.json({ ok: true, actualizado });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo guardar." }, { status: 502 });
  }
}
