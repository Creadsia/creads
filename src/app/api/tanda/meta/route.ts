import { SESSION_ENDED, session } from "@/lib/access";
import { cargarTanda } from "@/lib/tanda";
import { csvMeta, filasMeta, nombreCsv } from "@/lib/tanda-meta";

export const dynamic = "force-dynamic";

// GET ?id=<tanda id>[&pais=CL] → the Meta Ads Manager bulk-import CSV of a batch (columns: src/lib/tanda-meta.ts).
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return Response.json({ error: SESSION_ENDED }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const t = await cargarTanda(s.user.workspace, q.get("id") ?? "");
  if (!t) return Response.json({ error: "No encontramos esa tanda." }, { status: 404 });
  const pais = (q.get("pais") ?? "").toUpperCase();
  if (!filasMeta(t, { pais }).length) return Response.json({ error: "Esta tanda todavía no tiene imágenes listas." }, { status: 404 });
  return new Response(csvMeta(t, { pais }), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${nombreCsv(t)}"`, "cache-control": "no-store" },
  });
}
