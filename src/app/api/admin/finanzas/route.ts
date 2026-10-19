import { NextResponse } from "next/server";
import { currentUser, isAdmin } from "@/lib/admin";
import { isTheOwner } from "@/lib/auth";
import { DEFAULT_FINANZAS, type Finanzas, withCurrentPlans } from "@/lib/finance";
import { readPrivateJSON, writePrivateJSON } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const FILE = "finanzas.json";

// The finance book lives as one private JSON file in Supabase storage (owner only).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const data = withCurrentPlans((await readPrivateJSON<Finanzas>(FILE)) ?? DEFAULT_FINANZAS);
    // models connected after the book was first saved show up automatically
    const known = new Set(data.modelos.map((m) => m.id));
    const added = DEFAULT_FINANZAS.modelos.filter((m) => !known.has(m.id));
    return NextResponse.json(added.length ? { ...data, modelos: [...data.modelos, ...added] } : data);
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

/**
 * «Empezar de cero» (owner only, 19 Oct 2026): the whole book is archived as it is (finanzas/archivo-<time>.json,
 * nothing is lost) and its movements start empty, keeping only today's real customer payments (they are money
 * that came in). Fixed costs, model prices, accounts and settings stay.
 */
export async function POST(req: Request) {
  const u = await currentUser().catch(() => null);
  if (!isTheOwner(u)) return NextResponse.json({ error: "Solo el dueño puede reiniciar las finanzas." }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (b?.accion !== "reiniciar") return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
  try {
    const book = withCurrentPlans((await readPrivateJSON<Finanzas>(FILE)) ?? DEFAULT_FINANZAS);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await writePrivateJSON(`finanzas/archivo-${stamp}.json`, book);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
    const keep = book.movimientos.filter((m) => m.tipo === "ingreso" && m.fecha >= today && /· CR-[0-9A-F]+/.test(m.detalle ?? ""));
    await writePrivateJSON(FILE, { ...book, movimientos: keep, actualizado: new Date().toISOString() });
    return NextResponse.json({ ok: true, archivo: `finanzas/archivo-${stamp}.json`, conservados: keep.length, archivados: book.movimientos.length - keep.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo." }, { status: 502 });
  }
}
