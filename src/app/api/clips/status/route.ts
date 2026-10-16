import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { SESSION_ENDED, session } from "@/lib/access";
import { findVideo } from "@/lib/providers";
import { mediaRefOf, mediaSaved, saveMedia } from "@/lib/media";
import { explainFailure, serviceOfModel } from "@/lib/balances";
import { refundJob } from "@/lib/credits";
import { isOwner } from "@/lib/auth";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

/** Checks one clip with its provider; when it's ready, copies the video to our storage. */
export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const { db } = s;
  const id = new URL(req.url).searchParams.get("id") ?? "";
  try {
    const clip = await db.get("clips", id);
    if (!clip) return NextResponse.json({ error: "Corte no encontrado." }, { status: 404 });
    if (clip.status !== "generating" || !clip.provider_job) return NextResponse.json({ clip });
    const provider = findVideo(String(clip.model));
    if (!provider) return NextResponse.json({ error: "Modelo desconocido." }, { status: 400 });

    const st = await provider.status({ provider: provider.id, jobId: String(clip.provider_job) });
    if (st.state === "failed") {
      const error = await explainFailure(new Error(st.error), isOwner(s.user), serviceOfModel(provider.id));
      // Only the request that flips the clip from "generating" to "failed" refunds (two tabs polling at
      // once can't refund twice, nor refund an earlier run that worked).
      const row = await db.claim("clips", id, { in: ["generating"] }, { status: "failed", error: error.slice(0, 500) });
      if (row) await refundJob(s.user.workspace, id); // the provider didn't deliver: credits go back
      return NextResponse.json({ clip: row ?? (await db.get("clips", id)) });
    }
    if (st.state !== "done") return NextResponse.json({ clip });
    const ws = s.user.workspace;
    const name = `${createHash("sha256").update(String(clip.provider_job)).digest("hex").slice(0, 32)}.mp4`;
    let url = mediaRefOf(ws, "videos", name);
    if (!(await mediaSaved(ws, "videos", name))) {
      const bytes = provider.download ? await provider.download(st.url) : await (await fetch(st.url)).arrayBuffer();
      url = await saveMedia(ws, "videos", bytes, "video/mp4", name);
    }
    const row = await db.update("clips", id, { status: "done", url, error: null });

    // When every clip of the ad is finished, the ad moves to review.
    const all = await db.list("clips", `ad_id=eq.${clip.ad_id}&select=status`);
    if (all.length && all.every((c) => c.status === "done")) await db.update("ads", String(clip.ad_id), { status: "review" });
    return NextResponse.json({ clip: row });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "No se pudo revisar el corte." }, { status: 502 });
  }
}
