import { NextResponse } from "next/server";
import { checkAccess } from "@/lib/access";
import { db } from "@/lib/db";
import { probe } from "@/lib/montage";
import { checkTool, startTool, toolConfigured, type ToolInput } from "@/lib/providers/tools";
import { isOurMedia, uploadMedia } from "@/lib/supabase";
import { DUB_LANGS, findTool, type ToolDef } from "@/lib/tools";

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

async function readInput(t: ToolDef, b: Record<string, unknown>): Promise<{ input: ToolInput; seconds: number } | string> {
  const input: ToolInput = {};
  const need = t.inputs;
  if (need.image) {
    if (!isOurMedia(b.image)) return "Sube una foto.";
    input.image = b.image;
  }
  if (need.images) {
    const list = Array.isArray(b.images) ? b.images.filter(isOurMedia).slice(0, need.images) : [];
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
    if (!isOurMedia(b.video)) return "Sube un video.";
    input.video = b.video;
    const d = (await lengthOf(b.video)) || clientSecs;
    if (!d) return "No pude medir el largo del video. Prueba con un MP4.";
    if ((d < need.video.min - 0.3 || d > need.video.max + 0.5)) return `El video debe durar entre ${need.video.min} y ${need.video.max} segundos (este dura ${secs(d)}).`;
    seconds = d;
  }
  if (need.audio) {
    if (!isOurMedia(b.audio)) return "Sube un audio o genera la voz.";
    input.audio = b.audio;
    const d = (await lengthOf(b.audio)) || (need.video ? 0 : clientSecs);
    if (!d) return "No pude medir el largo del audio. Prueba con un MP3.";
    if ((d < need.audio.min - 0.3 || d > need.audio.max + 0.5)) return `El audio debe durar entre ${need.audio.min} y ${need.audio.max} segundos (este dura ${secs(d)}).`;
    if (t.id === "avatar-habla") seconds = d; // billed by the audio
  }
  return { input, seconds: input.seconds ?? seconds };
}

export async function POST(req: Request, ctx: { params: Promise<{ tool: string }> }) {
  const denied = await checkAccess(req);
  if (denied) return bad(denied, 401);
  const t = findTool((await ctx.params).tool);
  if (!t) return bad("Herramienta desconocida.", 404);
  if (!toolConfigured(t)) return bad(`${t.name}: falta la clave del proveedor en Vercel.`, 503);

  const b = (await req.json().catch(() => null)) ?? {};
  if (t.consent && b.consent !== true) return bad("Confirma que tienes permiso de la persona que aparece o habla.");
  const read = await readInput(t, b);
  if (typeof read === "string") return bad(read);
  const usd = t.estimate(read.seconds);

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
    const job = await startTool(t, read.input);
    await db.update("clips", id, { provider_job: job });
    return NextResponse.json({ id, usd });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo iniciar.";
    console.error("tools start", t.id, msg);
    await db.update("clips", id, { status: "failed", error: msg }).catch(() => null);
    return bad(msg, 502);
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ tool: string }> }) {
  const denied = await checkAccess(req);
  if (denied) return bad(denied, 401);
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
      await db.update("clips", id, { status: "failed", error: st.error });
      return NextResponse.json(st);
    }
    if (st.state !== "done") return NextResponse.json(st);

    const url = "url" in st ? st.url : await uploadMedia(`tools/${t.id}/${id}.${st.ext}`, await st.fetch(), st.mime);
    await db.update("clips", id, { status: "done", url });
    if (t.output === "image") await db.insert("images", { prompt: `${t.name}${row.prompt ? `: ${row.prompt}` : ""}`, url, model: t.model }).catch(() => null);
    return NextResponse.json({ state: "done", url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo revisar.";
    console.error("tools check", t.id, msg);
    return bad(msg, 502);
  }
}
