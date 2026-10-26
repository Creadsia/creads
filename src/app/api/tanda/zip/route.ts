import { strToU8, zipSync } from "fflate";
import { phCapture } from "@/lib/posthog-server";
import { after } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { fetchableUrl } from "@/lib/media";
import { cargarTanda, extDe, zipName } from "@/lib/tanda";
import { LEEME, csvMeta, nombreCsv } from "@/lib/tanda-meta";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// The whole batch as one ZIP, by placement: feed-4x5/… and stories-reels-9x16/…, numbered and named by angle,
// plus the Meta bulk-import CSV and a LEEME.txt with the three steps to upload it.
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return Response.json({ error: SESSION_ENDED }, { status: 401 });
  const ws = s.user.workspace;
  const t = await cargarTanda(ws, new URL(req.url).searchParams.get("id") ?? "");
  if (!t) return Response.json({ error: "No encontramos esos anuncios." }, { status: 404 });
  const files: Record<string, Uint8Array> = {};
  const jobs: Promise<void>[] = [];
  for (const p of t.piezas) for (const [f, ref] of [["4x5", p.f45], ["9x16", p.f916]] as const) {
    if (!ref) continue;
    jobs.push((async () => {
      const res = await fetch(await fetchableUrl(ref, ws, 600), { signal: AbortSignal.timeout(20_000) }).catch(() => null);
      if (!res?.ok) return;
      // the extension comes from the ref first, so the names match the ones in the Meta CSV
      files[zipName(p, f, extDe(ref, res.headers.get("content-type") ?? ""))] = new Uint8Array(await res.arrayBuffer());
    })());
  }
  // «Videos de producto», next to the images
  for (const p of t.piezas) {
    const ref = p.video?.estado === "listo" ? p.video.url : null;
    if (!ref) continue;
    jobs.push((async () => {
      const res = await fetch(await fetchableUrl(ref, ws, 600), { signal: AbortSignal.timeout(30_000) }).catch(() => null);
      if (res?.ok) files[`videos-9x16/${String(p.n).padStart(2, "0")}-video-producto.mp4`] = new Uint8Array(await res.arrayBuffer());
    })());
  }
  await Promise.all(jobs);
  if (!Object.keys(files).length) return Response.json({ error: "Tus anuncios todavía no tienen imágenes listas." }, { status: 404 });
  after(() => phCapture(s.user.id, "zip_downloaded", { tanda: t.id, archivos: Object.keys(files).length }));
  const csv = nombreCsv(t);
  files[csv] = strToU8(csvMeta(t));
  files["LEEME.txt"] = strToU8(`﻿${LEEME(csv)}\r\n`);
  const zip = zipSync(files, { level: 0 }); // images are already compressed
  const name = `creads-anuncios-${t.createdAt.slice(0, 10)}.zip`;
  return new Response(zip as unknown as BodyInit, { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${name}"`, "cache-control": "no-store" } });
}
