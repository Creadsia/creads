import { NextResponse, after } from "next/server";
import { watchFailures } from "@/lib/genstats";
import { SESSION_ENDED, session } from "@/lib/access";
import { refundedJobs } from "@/lib/credits";
import { findTool } from "@/lib/tools";

export const dynamic = "force-dynamic";

// Recent failed jobs (last 48 h), so the studio can say so first: "it failed, your credits are back,
// try again here" — before the customer has to ask. Only jobs whose credits were refunded are listed.

export interface FailNotice { id: string; what: string; href: string; when: string }

export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  // customers open the studio all day: a cheap moment to check whether generations are failing
  after(() => watchFailures());
  try {
    const since = Date.now() - 48 * 3600_000;
    const rows = (await s.db.list("clips", "status=eq.failed&order=created_at.desc&limit=12")) as Record<string, unknown>[];
    const recent = rows.filter((r) => Date.parse(String(r.created_at)) >= since);
    // only jobs whose credits actually came back (one that failed before charging isn't news here)
    const back = await refundedJobs(s.user.workspace, recent.map((r) => String(r.id)));
    const items: FailNotice[] = recent
      .filter((r) => back.has(String(r.id)))
      .map((r) => {
        const kind = String(r.kind ?? "");
        const tool = kind.startsWith("tool:") ? findTool(kind.slice(5)) : null;
        const [what, href] = r.ad_id && kind.startsWith("shot")
          ? ["una toma de tu historia animada", `/app/historias?id=${r.ad_id}`]
          : r.ad_id
          ? ["una escena de tu anuncio", `/app/videos/${r.ad_id}`]
          : tool
            ? [`«${tool.name}»`, `/app/herramientas/${tool.id}`]
            : kind === "gen:image"
              ? ["una imagen", "/app/laboratorio"]
              : ["un video", "/app/laboratorio"];
        return { id: String(r.id), what, href, when: String(r.created_at) };
      });
    return NextResponse.json({ items });
  } catch {
    // notices are a nicety: never an error on screen
    return NextResponse.json({ items: [] });
  }
}
