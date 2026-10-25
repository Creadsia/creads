import { zipSync } from "fflate";
import { SESSION_ENDED, session } from "@/lib/access";
import { fetchableUrl } from "@/lib/media";
import { cargarTanda, zipName } from "@/lib/tanda";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// The whole batch as one ZIP, by placement: feed-4x5/… and stories-reels-9x16/…, numbered and named by angle.
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return Response.json({ error: SESSION_ENDED }, { status: 401 });
  const ws = s.user.workspace;
  const t = await cargarTanda(ws, new URL(req.url).searchParams.get("id") ?? "");
  if (!t) return Response.json({ error: "No encontramos esa tanda." }, { status: 404 });
  const files: Record<string, Uint8Array> = {};
  const jobs: Promise<void>[] = [];
  for (const p of t.piezas) for (const [f, ref] of [["4x5", p.f45], ["9x16", p.f916]] as const) {
    if (!ref) continue;
    jobs.push((async () => {
      const res = await fetch(await fetchableUrl(ref, ws, 600), { signal: AbortSignal.timeout(20_000) }).catch(() => null);
      if (!res?.ok) return;
      const ext = (res.headers.get("content-type") ?? "").includes("png") ? "png" : (res.headers.get("content-type") ?? "").includes("webp") ? "webp" : "jpg";
      files[zipName(p, f, ext)] = new Uint8Array(await res.arrayBuffer());
    })());
  }
  await Promise.all(jobs);
  if (!Object.keys(files).length) return Response.json({ error: "Esta tanda todavía no tiene imágenes listas." }, { status: 404 });
  const zip = zipSync(files, { level: 0 }); // images are already compressed
  const name = `creads-tanda-${t.createdAt.slice(0, 10)}.zip`;
  return new Response(zip as unknown as BodyInit, { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" } });
}
