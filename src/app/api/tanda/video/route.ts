import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { findImage, findVideo } from "@/lib/providers";
import { fetchableUrl, ownsMedia, saveMedia } from "@/lib/media";
import { explainFailure, serviceOfModel } from "@/lib/balances";
import { isOwner } from "@/lib/auth";
import { refundJob } from "@/lib/credits";
import { failMessage, failStatus, payFor } from "@/lib/paid";
import { publicError } from "@/lib/public-error";
import { cargarMarca } from "@/lib/marca";
import { actualizarPieza, cargarTanda } from "@/lib/tanda";
import { ESTILOS_VIDEO, type EstiloVideo, escenaPrompt, esEstiloVideo, movimientoPrompt } from "@/lib/video-producto";
import { pasadaTextos, textosAss } from "@/lib/editor";
import { workdir } from "@/lib/montage";

export const maxDuration = 120;
export const dynamic = "force-dynamic";

// «Video de producto» for one piece of a batch (see src/lib/video-producto.ts).
//   POST {id, n, estilo?} → the scene picture (charged) and the video job (charged); the piece shows «creando»
//   GET ?id=…&n=…        → checks the job; when ready, burns the headline and saves the final 9:16 video

const VIDEO_MODELS = ["hailuo-2.3-pro", "hailuo-2.3"];
const SECONDS = 6;

export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("gen", s.user.id);
  if (limited) return limited;
  const ws = s.user.workspace;
  const b = await req.json().catch(() => null);
  const t = await cargarTanda(ws, String(b?.id ?? ""));
  const pieza = t?.piezas.find((p) => p.n === Number(b?.n));
  if (!t || !pieza) return NextResponse.json({ error: "No encontramos ese anuncio." }, { status: 404 });
  if (pieza.video?.estado === "creando") return NextResponse.json({ ok: true, video: pieza.video });
  const ref = t.producto.foto || pieza.f916 || pieza.f45 || "";
  if (!ownsMedia(ref, ws)) return NextResponse.json({ error: "Para el video necesitamos la foto de tu producto. Súbela en tu kit de marca o crea primero la imagen de este anuncio." }, { status: 400 });
  const estilo: EstiloVideo = esEstiloVideo(b?.estilo) ? b.estilo : ESTILOS_VIDEO[(pieza.n - 1) % ESTILOS_VIDEO.length].id;

  const img = [findImage("nano-banana-2"), findImage("nano-banana-pro")].find((p) => p?.configured());
  const vid = VIDEO_MODELS.map((m) => findVideo(m)).find((p) => p?.configured());
  if (!img || !vid) return NextResponse.json({ error: "El video de producto no está disponible en este momento. No se usó tu saldo." }, { status: 503 });

  // 1 · the scene (the real product, no text)
  let escena = "";
  const imgCharge = await payFor(s.user, img.usdPerImage, `Video de producto · escena · ${img.label}`, serviceOfModel(img.id)).catch((e) => e as Error);
  if (imgCharge instanceof Error) return NextResponse.json({ error: await failMessage(imgCharge, s.user, serviceOfModel(img.id)) }, { status: failStatus(imgCharge) });
  try {
    const m = await cargarMarca(ws);
    const { bytes, mime } = await img.generate({
      prompt: escenaPrompt({ estilo, producto: `${t.producto.nombre}. ${t.producto.descripcion}`.slice(0, 400), marca: m.nombre ? `Brand colours ${m.c1} and ${m.c2}.` : "" }),
      aspect: "9:16", refs: [{ url: await fetchableUrl(ref, ws), role: "product" }],
    });
    escena = await saveMedia(ws, "tandas", bytes, mime);
  } catch (err) {
    await refundJob(ws, imgCharge.ref);
    return NextResponse.json({ error: publicError(err, "No se pudo crear la escena del video. No se usó tu saldo.") }, { status: 502 });
  }

  // 2 · the video
  const usd = +(vid.usdPerSecond * SECONDS).toFixed(2);
  const charge = await payFor(s.user, usd, `Video de producto · ${vid.label}`, serviceOfModel(vid.id)).catch((e) => e as Error);
  if (charge instanceof Error) return NextResponse.json({ error: await failMessage(charge, s.user, serviceOfModel(vid.id)) }, { status: failStatus(charge) });
  try {
    const job = await vid.submit({ prompt: movimientoPrompt({ estilo }), seconds: SECONDS, aspect: "9:16", resolution: "1080p", withAudio: false, refs: [{ url: await fetchableUrl(escena, ws), role: "first_frame" }] });
    const video = { estado: "creando" as const, estilo, modelo: vid.id, job: job.jobId, escena, cargo: charge.ref };
    const out = await actualizarPieza(ws, t.id, pieza.n, { video });
    return NextResponse.json({ ok: true, video, tanda: out ?? null });
  } catch (err) {
    await refundJob(ws, charge.ref);
    const msg = await failMessage(err, s.user, serviceOfModel(vid.id));
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

export async function GET(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const ws = s.user.workspace;
  const q = new URL(req.url).searchParams;
  const t = await cargarTanda(ws, q.get("id") ?? "");
  const pieza = t?.piezas.find((p) => p.n === Number(q.get("n")));
  const v = pieza?.video;
  if (!t || !pieza || !v) return NextResponse.json({ error: "No encontramos ese video." }, { status: 404 });
  if (v.estado !== "creando" || !v.job || !v.modelo) return NextResponse.json({ video: v });
  const vid = findVideo(v.modelo);
  if (!vid) return NextResponse.json({ video: v });
  try {
    const st = await vid.status({ provider: vid.id, jobId: v.job });
    if (st.state === "failed") {
      const error = await explainFailure(new Error(st.error), isOwner(s.user), serviceOfModel(vid.id));
      if (v.cargo) await refundJob(ws, v.cargo);
      const out = await actualizarPieza(ws, t.id, pieza.n, { video: { ...v, estado: "error", error } });
      return NextResponse.json({ video: { ...v, estado: "error", error }, tanda: out ?? null });
    }
    if (st.state !== "done") return NextResponse.json({ video: v });
    // the finished clip, with the ad's headline on top (in the calm area the scene left free)
    const raw = vid.download ? await vid.download(st.url) : await (await fetch(st.url)).arrayBuffer();
    const dir = await workdir(`tv-${t.id}-${pieza.n}`);
    const titular = pieza.titular.replace(/[{}\\]/g, "").slice(0, 80);
    let bytes: Uint8Array | Buffer = new Uint8Array(raw);
    if (titular) {
      bytes = await pasadaTextos(dir, bytes, textosAss([{ id: "t", texto: titular, desde: 0.2, hasta: SECONDS + 1, x: 50, y: 17, tam: 7.2, color: "#FFFFFF", fondo: null, fuente: "Montserrat ExtraBold", animacion: "pop" }], 1080, 1920))
        .catch(() => new Uint8Array(raw));
    }
    const url = await saveMedia(ws, "tandas", bytes, "video/mp4", `${t.id}-${pieza.n}-${Date.now()}.mp4`);
    const video = { ...v, estado: "listo" as const, url, job: undefined };
    const out = await actualizarPieza(ws, t.id, pieza.n, { video });
    return NextResponse.json({ video, tanda: out ?? null });
  } catch (err) {
    return NextResponse.json({ error: publicError(err, "No se pudo revisar el video.") }, { status: 502 });
  }
}
