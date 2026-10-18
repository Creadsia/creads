import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { launchChecks, launchDone, saveLaunchDone } from "@/lib/lanzamiento-checks";

export const dynamic = "force-dynamic";

// The launch checklist (owner only). GET: what the server checks by itself + what was ticked by hand.
// POST {done}: saves the ticks (so they're the same on every device and the office can read them).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const [checks, done] = await Promise.all([launchChecks(), launchDone()]);
  return NextResponse.json({ checks, done });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b?.done || typeof b.done !== "object") return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  await saveLaunchDone(b.done);
  return NextResponse.json({ ok: true });
}
