import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { checkAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { findVideo } from "@/lib/providers";
import { mediaExists, publicUrl, uploadMedia } from "@/lib/supabase";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Checks one clip with its provider; when it's ready, copies the video to our storage. */
export async function GET(req: Request) {
  const denied = checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  try {
    const clip = await db.get("clips", id);
    if (!clip) return NextResponse.json({ error: "Corte no encontrado." }, { status: 404 });
    if (clip.status !== "generating" || !clip.provider_job) return NextResponse.json({ clip });
    const provider = findVideo(String(clip.model));
    if (!provider) return NextResponse.json({ error: "Modelo desconocido." }, { status: 400 });

    const st = await provider.status({ provider: provider.id, jobId: String(clip.provider_job) });
    if (st.state === "failed") {
      const row = await db.update("clips", id, { status: "failed", error: st.error.slice(0, 500) });
      return NextResponse.json({ clip: row });
    }
    if (st.state !== "done") return NextResponse.json({ clip });
    const path = `videos/${createHash("sha256").update(String(clip.provider_job)).digest("hex").slice(0, 32)}.mp4`;
    if (!(await mediaExists(path))) {
      const bytes = provider.download ? await provider.download(st.url) : await (await fetch(st.url)).arrayBuffer();
      await uploadMedia(path, bytes, "video/mp4");
    }
    const row = await db.update("clips", id, { status: "done", url: publicUrl(path), error: null });

    // When every clip of the ad is finished, the ad moves to review.
    const all = await db.list("clips", `ad_id=eq.${clip.ad_id}&select=status`);
    if (all.length && all.every((c) => c.status === "done")) await db.update("ads", String(clip.ad_id), { status: "review" });
    return NextResponse.json({ clip: row });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo revisar el corte." }, { status: 502 });
  }
}
