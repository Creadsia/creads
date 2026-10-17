import { NextResponse } from "next/server";
import { billedSeconds } from "@/lib/historias";
import { tooMany } from "@/lib/rate";
import { createHash } from "node:crypto";
import { fullSession } from "@/lib/access";
import { findVideo } from "@/lib/providers";
import type { AspectRatio, MediaRef } from "@/lib/providers/types";
import { fetchableUrl, mediaRefOf, mediaSaved, ownsMedia, saveMedia } from "@/lib/media";
import { explainFailure, serviceOfModel } from "@/lib/balances";
import { isOwner } from "@/lib/auth";
import { refundJob } from "@/lib/credits";
import { UNAVAILABLE as UNAVAILABLE_TEXT, publicError } from "@/lib/public-error";
import { failMessage, failStatus, payFor } from "@/lib/paid";

export const maxDuration = 120;

// POST starts a video (returns a job). GET ?model=…&job=… checks it; when it's done the file is copied
// into our storage once and its public link returned. Costs real money: the studio shows the price first.

export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const limited = await tooMany("gen", s.user.id);
  if (limited) return limited;
  const { db } = s;

  const body = await req.json().catch(() => null);
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim().slice(0, 3000) : "";
  const aspect: AspectRatio = (["9:16", "16:9", "1:1", "4:5"] as const).find((a) => a === body?.aspect) ?? "9:16";
  const asked = Math.min(15, Math.max(3, Math.round(Number(body?.seconds) || 8)));
  const firstFrame = ownsMedia(body?.firstFrame, s.user.workspace) ? body.firstFrame : "";
  if (prompt.length < 10) return NextResponse.json({ error: "Describe la escena con un poco más de detalle." }, { status: 400 });

  const provider = findVideo(String(body?.model ?? ""));
  if (!provider) return NextResponse.json({ error: "Modelo desconocido." }, { status: 400 });
  if (!provider.configured()) return NextResponse.json({ error: UNAVAILABLE_TEXT }, { status: 503 });

  // charge for (and ask) the length the model really makes
  const seconds = billedSeconds(asked, provider.durations, provider.id.startsWith("veo"));
  const svc = serviceOfModel(provider.id);
  const usd = +(provider.usdPerSecond * seconds).toFixed(2);
  // Recorded first (so it shows in "Tus creaciones" even if the tab is closed); its id ties the charge to it.
  let row: Record<string, unknown>;
  try {
    row = await db.insert("clips", { kind: "gen:video", prompt, model: provider.id, status: "running", image_url: firstFrame || null, text: `${seconds} s`, usd });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo guardar el trabajo.") }, { status: 502 });
  }
  const id = String(row.id);
  try {
    await payFor(s.user, usd, `Video · ${provider.label}`, svc, { ref: id });
  } catch (err) {
    await db.remove("clips", id).catch(() => null);
    return NextResponse.json({ error: await failMessage(err, s.user, svc) }, { status: failStatus(err) });
  }
  try {
    const refs: MediaRef[] = firstFrame ? [{ url: await fetchableUrl(firstFrame, s.user.workspace), role: "first_frame" }] : [];
    const job = await provider.submit({ prompt, seconds, aspect, resolution: "720p", withAudio: true, refs });
    await db.update("clips", id, { provider_job: job.jobId });
    return NextResponse.json({ job, usd });
  } catch (err) {
    console.error("generate/video submit", provider.id, err instanceof Error ? err.message : err);
    await refundJob(s.user.workspace, id);
    const msg = await failMessage(err, s.user, svc);
    await db.update("clips", id, { status: "failed", error: msg.slice(0, 500) }).catch(() => null);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function GET(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const { db } = s;

  const q = new URL(req.url).searchParams;
  const provider = findVideo(q.get("model") ?? "");
  const jobId = q.get("job") ?? "";
  if (!provider || !jobId) return NextResponse.json({ error: "Falta el modelo o el trabajo." }, { status: 400 });

  try {
    // only jobs this workspace started
    const row = (await db.list("clips", `kind=eq.gen:video&provider_job=eq.${encodeURIComponent(jobId)}&limit=1`))[0];
    if (!row) return NextResponse.json({ error: "No encontré ese video en tu cuenta." }, { status: 404 });
    if (row.status === "done" && row.url) return NextResponse.json({ state: "done", url: row.url });
    const st = await provider.status({ provider: provider.id, jobId });
    if (st.state === "failed") {
      const error = await explainFailure(new Error(st.error), isOwner(s.user), serviceOfModel(provider.id));
      await db.update("clips", String(row.id), { status: "failed", error }).catch(() => null);
      await refundJob(s.user.workspace, String(row.id));
      return NextResponse.json({ state: "failed", error });
    }
    if (st.state !== "done") return NextResponse.json(st);

    // Copy once into the customer's private storage, under a stable name derived from the job.
    const name = `${createHash("sha256").update(jobId).digest("hex").slice(0, 32)}.mp4`;
    const ws = s.user.workspace;
    let url = mediaRefOf(ws, "videos", name);
    if (!(await mediaSaved(ws, "videos", name))) {
      const bytes = provider.download ? await provider.download(st.url) : await (await fetch(st.url)).arrayBuffer();
      url = await saveMedia(ws, "videos", bytes, "video/mp4", name);
    }
    await db.update("clips", String(row.id), { status: "done", url }).catch(() => null);
    return NextResponse.json({ state: "done", url });
  } catch (err) {
    const msg = publicError(err, "No se pudo revisar el video.");
    console.error("generate/video status", provider.id, msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
