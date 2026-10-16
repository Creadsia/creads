import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { checkAccess } from "@/lib/access";
import { findVideo } from "@/lib/providers";
import type { AspectRatio, MediaRef } from "@/lib/providers/types";
import { db } from "@/lib/db";
import { mediaExists, publicUrl, uploadMedia } from "@/lib/supabase";

export const maxDuration = 120;

// POST starts a video (returns a job). GET ?model=…&job=… checks it; when it's done the file is copied
// into our storage once and its public link returned. Costs real money: the studio shows the price first.

export async function POST(req: Request) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 3000) : "";
  const aspect: AspectRatio = (["9:16", "16:9", "1:1", "4:5"] as const).find((a) => a === body?.aspect) ?? "9:16";
  const seconds = Math.min(15, Math.max(3, Math.round(Number(body?.seconds) || 8)));
  const firstFrame = typeof body?.firstFrame === "string" && body.firstFrame.startsWith("https://") ? body.firstFrame : "";
  if (prompt.length < 10) return NextResponse.json({ error: "Describe la escena con un poco más de detalle." }, { status: 400 });

  const provider = findVideo(String(body?.model ?? ""));
  if (!provider) return NextResponse.json({ error: "Modelo desconocido." }, { status: 400 });
  if (!provider.configured()) return NextResponse.json({ error: `${provider.label}: falta la clave en Vercel.` }, { status: 503 });

  const refs: MediaRef[] = firstFrame ? [{ url: firstFrame, role: "first_frame" }] : [];
  try {
    const job = await provider.submit({ prompt, seconds, aspect, resolution: "720p", withAudio: true, refs });
    const usd = +(provider.usdPerSecond * seconds).toFixed(2);
    // recorded so the clip shows in "Tus creaciones" even if the tab is closed
    await db.insert("clips", { kind: "gen:video", prompt, model: provider.id, provider_job: job.jobId, status: "running", image_url: firstFrame || null, text: `${seconds} s`, usd }).catch(() => null);
    return NextResponse.json({ job, usd });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo iniciar el video.";
    console.error("generate/video submit", provider.id, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function GET(req: Request) {
  const denied = await checkAccess(req);
  if (denied) return NextResponse.json({ error: denied }, { status: 401 });

  const q = new URL(req.url).searchParams;
  const provider = findVideo(q.get("model") ?? "");
  const jobId = q.get("job") ?? "";
  if (!provider || !jobId) return NextResponse.json({ error: "Falta el modelo o el trabajo." }, { status: 400 });

  try {
    const st = await provider.status({ provider: provider.id, jobId });
    if (st.state === "failed") {
      const rows = await db.list("clips", `kind=eq.gen:video&provider_job=eq.${encodeURIComponent(jobId)}&limit=1`).catch(() => []);
      if (rows[0]) await db.update("clips", String(rows[0].id), { status: "failed", error: st.error }).catch(() => null);
    }
    if (st.state !== "done") return NextResponse.json(st);

    // Copy once into our storage, under a stable name derived from the job.
    const path = `videos/${createHash("sha256").update(jobId).digest("hex").slice(0, 32)}.mp4`;
    if (!(await mediaExists(path))) {
      const bytes = provider.download ? await provider.download(st.url) : await (await fetch(st.url)).arrayBuffer();
      await uploadMedia(path, bytes, "video/mp4");
    }
    const url = publicUrl(path);
    const rows = await db.list("clips", `kind=eq.gen:video&provider_job=eq.${encodeURIComponent(jobId)}&limit=1`).catch(() => []);
    if (rows[0] && rows[0].status !== "done") await db.update("clips", String(rows[0].id), { status: "done", url }).catch(() => null);
    return NextResponse.json({ state: "done", url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo revisar el video.";
    console.error("generate/video status", provider.id, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
