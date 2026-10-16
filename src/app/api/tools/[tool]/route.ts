import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { fullSession } from "@/lib/access";
import { probe } from "@/lib/montage";
import { checkTool, startTool, toolConfigured, type ToolInput } from "@/lib/providers/tools";
import { fetchableUrl, ownsMedia, saveMedia } from "@/lib/media";
import { DUB_LANGS, findTool, type ToolDef } from "@/lib/tools";
import { explainFailure, serviceOf } from "@/lib/balances";
import { refundJob } from "@/lib/credits";
import { failMessage, failStatus, payFor } from "@/lib/paid";
import { isOwner } from "@/lib/auth";

export const maxDuration = 120;

// POST starts a "Crear" tool and records the job (so a closed tab never loses work that was paid for).
// GET ?id=<job row> checks it; when it's finished the result is copied to our storage once.
// Every job costs real money: the page shows the price before the button, and the length of any
// video or audio is measured here so the limits can't be skipped.

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
const secs = (n: number) => `${Math.round(n)} s`;

/** Length of a hosted video/audio in seconds (0 if it couldn't be read). */
async function lengthOf(url: string) {
  try {
    return (await probe(url)).dur;
  } catch {
    return 0;
  }
}

async function readInput(t: ToolDef, b: Record<string, unknown>, ws: string): Promise<{ input: ToolInput; seconds: number } | string> {
  const input: ToolInput = {};
  const mine = (u: unknown): u is string => ownsMedia(u, ws);
  const open = (u: string) => fetchableUrl(u, ws);
  const need = t.inputs;
  if (need.image) {
    if (!mine(b.image)) return "Sube una foto.";
    input.image = b.image;
  }
  if (need.images) {
    const list = Array.isArray(b.images) ? b.images.filter(mine).slice(0, need.images) : [];
    if (!list.length) return "Sube al menos una foto.";
    input.images = list;
  }
  if (need.prompt) {
    const p = typeof b.prompt === "string" ? b.prompt.trim().slice(0, 2000) : "";
    if (need.prompt === "required" && p.length < 4) return "Escribe qué quieres que haga.";
    if (p) input.prompt = p;
  }
  if (need.target) {
    const lang = DUB_LANGS.find((l) => l.id === b.target)?.id;
    if (!lang) return "Elige el idioma del doblaje.";
    input.target = lang;
  }

  if (need.length) {
    const n = Number(b.length);
    if (!need.length.includes(n)) return "Elige el largo.";
    input.seconds = n;
    if (need.instrumental) input.instrumental = b.instrumental === true;
  }

  // Measure what the customer gave: the price and the limits depend on it.
  const clientSecs = Math.max(0, Number(b.seconds) || 0);
  let seconds = 0;
  if (need.video) {
    if (!mine(b.video)) return "Sube un video.";
    input.video = b.video;
    const d = (await lengthOf(await open(b.video))) || clientSecs;
    if (!d) return "No pude medir el largo del video. Prueba con un MP4.";
    if ((d < need.video.min - 0.3 || d > need.video.max + 0.5)) return `El video debe durar entre ${need.video.min} y ${need.video.max} segundos (este dura ${secs(d)}).`;
    seconds = d;
  }
  if (need.audio) {
    if (!mine(b.audio)) return "Sube un audio o genera la voz.";
    input.audio = b.audio;
    const d = (await lengthOf(await open(b.audio))) || (need.video ? 0 : clientSecs);
    if (!d) return "No pude medir el largo del audio. Prueba con un MP3.";
    if ((d < need.audio.min - 0.3 || d > need.audio.max + 0.5)) return `El audio debe durar entre ${need.audio.min} y ${need.audio.max} segundos (este dura ${secs(d)}).`;
    if (t.id === "avatar-habla") seconds = d; // billed by the audio
  }
  return { input, seconds: input.seconds ?? seconds };
}

export async function POST(req: Request, ctx: { params: Promise<{ tool: string }> }) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const limited = await tooMany("gen", s.user.id);
  if (limited) return limited;
  const { db } = s;
  const t = findTool((await ctx.params).tool);
  if (!t) return bad("Herramienta desconocida.", 404);
  if (!toolConfigured(t)) return bad(`${t.name}: falta la clave del proveedor en Vercel.`, 503);

  const b = (await req.json().catch(() => null)) ?? {};
  if (t.consent && b.consent !== true) return bad("Confirma que tienes permiso de la persona que aparece o habla.");
  const read = await readInput(t, b, s.user.workspace);
  if (typeof read === "string") return bad(read);
  const usd = t.estimate(read.seconds);
  const svc = serviceOf(`tool:${t.id}`, null);

  // Record first, then start: if the provider takes the job, it is never lost (and never paid twice).
  let row: Record<string, unknown>;
  try {
    row = await db.insert("clips", {
      kind: `tool:${t.id}`,
      prompt: read.input.prompt ?? read.input.target ?? null,
      model: t.model,
      status: "running",
      image_url: read.input.image ?? read.input.images?.[0] ?? read.input.video ?? null,
      text: read.seconds ? secs(read.seconds) : null,
      usd,
    });
  } catch (err) {
    return bad(err instanceof Error ? err.message : "No se pudo guardar el trabajo.", 502);
  }
  const id = String(row.id);
  try {
    await payFor(s.user, usd, t.name, svc, { ref: id });
  } catch (err) {
    await db.remove("clips", id).catch(() => null);
    return bad(await failMessage(err, s.user, svc), failStatus(err));
  }
  try {
    // outside services get short-lived links to the customer's files
    const ws = s.user.workspace;
    const open = async (u?: string) => (u ? fetchableUrl(u, ws) : undefined);
    const input: ToolInput = {
      ...read.input,
      image: await open(read.input.image),
      video: await open(read.input.video),
      audio: await open(read.input.audio),
      images: read.input.images ? await Promise.all(read.input.images.map((u) => fetchableUrl(u, ws))) : undefined,
    };
    const job = await startTool(t, input, ws);
    await db.update("clips", id, { provider_job: job });
    return NextResponse.json({ id, usd });
  } catch (err) {
    console.error("tools start", t.id, err instanceof Error ? err.message : err);
    await refundJob(s.user.workspace, id);
    const msg = await failMessage(err, s.user, svc);
    await db.update("clips", id, { status: "failed", error: msg }).catch(() => null);
    return bad(msg, 502);
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ tool: string }> }) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const { db } = s;
  const t = findTool((await ctx.params).tool);
  if (!t) return bad("Herramienta desconocida.", 404);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return bad("Falta el trabajo.");

  try {
    const row = await db.get("clips", id);
    if (!row || row.kind !== `tool:${t.id}`) return bad("No encontré ese trabajo.", 404);
    if (row.status === "done") return NextResponse.json({ state: "done", url: row.url });
    if (row.status === "failed") return NextResponse.json({ state: "failed", error: row.error });
    if (!row.provider_job) return NextResponse.json({ state: "queued" });

    const st = await checkTool(t, String(row.provider_job));
    if (st.state === "failed") {
      const error = await explainFailure(new Error(st.error), isOwner(s.user), serviceOf(`tool:${t.id}`, null));
      await db.update("clips", id, { status: "failed", error });
      await refundJob(s.user.workspace, id);
      return NextResponse.json({ state: "failed", error });
    }
    if (st.state !== "done") return NextResponse.json(st);

    const url = "url" in st ? st.url : await saveMedia(s.user.workspace, `tools/${t.id}`, await st.fetch(), st.mime, `${id}.${st.ext}`);
    await db.update("clips", id, { status: "done", url });
    if (t.output === "image") await db.insert("images", { prompt: `${t.name}${row.prompt ? `: ${row.prompt}` : ""}`, url, model: t.model }).catch(() => null);
    return NextResponse.json({ state: "done", url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo revisar.";
    console.error("tools check", t.id, msg);
    return bad(msg, 502);
  }
}
