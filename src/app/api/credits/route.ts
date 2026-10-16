import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { isOwner } from "@/lib/auth";
import { creditStatus, history } from "@/lib/credits";

export const dynamic = "force-dynamic";

// The signed-in customer's credits: balance, plan, how prices are computed and (?history=1) the
// last movements. Creadsia's owner has no limit.
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  try {
    const st = await creditStatus(s.user.workspace);
    const withHistory = new URL(req.url).searchParams.get("history") && !st.unlimited;
    const moves = withHistory ? await history(s.user.workspace, 50).catch(() => []) : [];
    // customers see credits only; what each job costs Creadsia in dollars stays with the owner
    return NextResponse.json({
      ...st,
      owner: isOwner(s.user),
      history: moves.map((m) => ({ id: m.id, delta: m.delta, kind: m.kind, note: m.note, created_at: m.created_at })),
    });
  } catch {
    return NextResponse.json({ error: "No se pudieron leer tus créditos." }, { status: 502 });
  }
}
