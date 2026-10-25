import { findImage, findVideo } from "./providers";
import { fetchableUrl, ownsMedia, saveMedia } from "./media";
import { explainFailure, serviceOfModel } from "./balances";
import { type User, isOwner } from "./auth";
import { refundJob } from "./credits";
import { payFor } from "./paid";
import { readPrivateJSON, writePrivateJSON } from "./supabase";
import { pasadaTextos, textosAss } from "./editor";
import { workdir } from "./montage";
import { ESTILOS_VIDEO, type EstiloVideo, escenaPrompt, esEstiloVideo, movimientoPrompt } from "./video-producto";

// «Video de producto», server side (owner, 25 Oct 2026). Shared by /api/video-producto (studio, API and the
// Creads connector) and the batch (/api/tanda/video). Each step is charged on its own and given back if it fails.

export const VIDEO_MODELS = ["hailuo-2.3-pro", "hailuo-2.3"];
export const SECONDS = 6;

export interface VideoProducto {
  id: string; createdAt: string; estado: "creando" | "listo" | "error"; estilo: EstiloVideo;
  modelo: string; job?: string; escena: string; cargo?: string; titular: string; url?: string; error?: string;
}

const file = (ws: string, id: string) => `videos-producto/${ws}/${id}.json`;
export const validVideoId = (id: unknown): id is string => typeof id === "string" && /^vp_[a-z0-9]{8,20}$/.test(id);
export const cargarVideo = (ws: string, id: string) => (validVideoId(id) ? readPrivateJSON<VideoProducto>(file(ws, id)).catch(() => null) : Promise.resolve(null));
const guardar = (ws: string, v: VideoProducto) => writePrivateJSON(file(ws, v.id), v);

export class VideoError extends Error { constructor(msg: string, public status = 400) { super(msg); } }

/** Makes the scene (the real product, no text) and starts the animation. Returns the saved job. */
export async function empezarVideoProducto(user: User, o: { producto: string; estilo?: unknown; titular?: string; descripcion?: string; colores?: string }): Promise<VideoProducto> {
  const ws = user.workspace;
  if (!ownsMedia(o.producto, ws)) throw new VideoError("Para el video necesitamos una foto del producto de tu cuenta (súbela o créala primero).");
  const estilo: EstiloVideo = esEstiloVideo(o.estilo) ? o.estilo : ESTILOS_VIDEO[0].id;
  const img = [findImage("nano-banana-2"), findImage("nano-banana-pro")].find((p) => p?.configured());
  const vid = VIDEO_MODELS.map((m) => findVideo(m)).find((p) => p?.configured());
  if (!img || !vid) throw new VideoError("El video de producto no está disponible en este momento. No se usó tu saldo.", 503);

  // 1 · the scene
  const imgCharge = await payFor(user, img.usdPerImage, `Video de producto · escena · ${img.label}`, serviceOfModel(img.id));
  let escena: string;
  try {
    const { bytes, mime } = await img.generate({
      prompt: escenaPrompt({ estilo, producto: (o.descripcion ?? "").slice(0, 400), marca: o.colores ? `Brand colours ${o.colores}.` : "" }),
      aspect: "9:16", refs: [{ url: await fetchableUrl(o.producto, ws), role: "product" }],
    });
    escena = await saveMedia(ws, "videos-producto", bytes, mime);
  } catch (err) {
    await refundJob(ws, imgCharge.ref);
    throw err;
  }

  // 2 · the animation
  const usd = +(vid.usdPerSecond * SECONDS).toFixed(2);
  const charge = await payFor(user, usd, `Video de producto · ${vid.label}`, serviceOfModel(vid.id));
  try {
    const job = await vid.submit({ prompt: movimientoPrompt({ estilo }), seconds: SECONDS, aspect: "9:16", resolution: "1080p", withAudio: false, refs: [{ url: await fetchableUrl(escena, ws), role: "first_frame" }] });
    const v: VideoProducto = {
      id: `vp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString(), estado: "creando",
      estilo, modelo: vid.id, job: job.jobId, escena, cargo: charge.ref, titular: (o.titular ?? "").replace(/[{}\\]/g, "").trim().slice(0, 80),
    };
    await guardar(ws, v);
    return v;
  } catch (err) {
    await refundJob(ws, charge.ref);
    throw err;
  }
}

/** Checks the animation; when ready, burns the headline (if any) and saves the final 9:16 video. */
export async function revisarVideoProducto(user: User, v: VideoProducto): Promise<VideoProducto> {
  const ws = user.workspace;
  if (v.estado !== "creando" || !v.job) return v;
  const vid = findVideo(v.modelo);
  if (!vid) return v;
  const st = await vid.status({ provider: vid.id, jobId: v.job });
  if (st.state === "failed") {
    const error = await explainFailure(new Error(st.error), isOwner(user), serviceOfModel(vid.id));
    if (v.cargo) await refundJob(ws, v.cargo);
    const out = { ...v, estado: "error" as const, error, job: undefined };
    await guardar(ws, out);
    return out;
  }
  if (st.state !== "done") return v;
  const raw = new Uint8Array(vid.download ? await vid.download(st.url) : await (await fetch(st.url)).arrayBuffer());
  let bytes: Uint8Array | Buffer = raw;
  if (v.titular) {
    const dir = await workdir(`vp-${v.id}`);
    bytes = await pasadaTextos(dir, raw, textosAss([{ id: "t", texto: v.titular, desde: 0.2, hasta: SECONDS + 1, x: 50, y: 15, tam: 11.5, color: "#FFFFFF", fondo: null, fuente: "Montserrat ExtraBold", animacion: "pop" }], 1080, 1920), "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1").catch(() => raw);
  }
  const url = await saveMedia(ws, "videos-producto", bytes, "video/mp4", `${v.id}.mp4`);
  const out = { ...v, estado: "listo" as const, url, job: undefined };
  await guardar(ws, out);
  return out;
}
