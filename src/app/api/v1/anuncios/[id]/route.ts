import { NextResponse } from "next/server";
import { session, SESSION_ENDED } from "@/lib/access";
import { advanceAd, loadAd, publicAd, studioAs } from "@/lib/api-ads";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET: the ad's status. Each call moves it one step forward (ask every 15–30 s until «listo» or «error»).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const job = await loadAd(s.user.workspace, (await ctx.params).id);
  if (!job) return NextResponse.json({ error: "No encontré ese anuncio." }, { status: 404 });
  const now = await advanceAd(job, studioAs(req));
  return NextResponse.json({ anuncio: publicAd(now) });
}
