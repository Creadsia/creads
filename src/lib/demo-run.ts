// Builds a «Demo con presentador» from ads that are already «listo» (shared by POST /api/v1/montajes and by the
// subtitle corrections, which build it again with the corrected words — free, nothing is generated again).

import path from "node:path";
import { readFile } from "node:fs/promises";
import { loadAd } from "./api-ads";
import { type Correccion, applyFixes, download, probe, respell, workdir } from "./montage";
import { fetchableUrl, ownsMedia, saveMedia } from "./media";
import { elevenlabs } from "./providers/elevenlabs";
import { mediaRef } from "./mcp";
import { demoAss, finishDemo, planDemo, renderCard, renderSlot } from "./demo-montage";

export interface DemoParams { presentador: string; ejemplos: string[]; producto?: string | null; prompt?: string; cierre?: string; linea?: string; correcciones?: Correccion[] }

export class DemoInputError extends Error { constructor(msg: string, public status = 400) { super(msg); } }

/** Builds the demo video and saves it; returns its link, length and the presenter's title, script and language. */
export async function runDemo(ws: string, p: DemoParams) {
  const ids = p.ejemplos.slice(0, 6);
  if (!p.presentador || ids.length < 2) throw new DemoInputError("Manda «presentador» (el id del anuncio del presentador) y al menos 2 «ejemplos».");
  const host = await loadAd(ws, p.presentador);
  const exs = await Promise.all(ids.map((id) => loadAd(ws, id)));
  if ([host, ...exs].some((x) => !x || x.estado !== "listo" || !x.videoUrl)) throw new DemoInputError("Todos los anuncios tienen que ser de esta cuenta y estar listos.", 409);
  const product = p.producto ? mediaRef(p.producto) : null;
  if (product && (!ownsMedia(product, ws) || !/\.(png|jpe?g|webp)$/i.test(product))) throw new DemoInputError("La foto del producto tiene que ser una imagen de esta cuenta.");
  const lang = host!.idioma === "en" ? "en" : "es";

  const dir = await workdir(`demo-${host!.id}`);
  const hostSrc = await fetchableUrl(mediaRef(host!.videoUrl!), ws);
  const hostFile = path.join(dir, "host.mp4");
  await download(hostSrc, hostFile);
  const ex = await Promise.all(exs.map(async (x, i) => {
    const f = path.join(dir, `ex${i}.mp4`);
    await download(await fetchableUrl(mediaRef(x!.videoUrl!), ws), f);
    return { file: f, dur: (await probe(f)).dur };
  }));
  let productFile: string | null = null;
  if (product) { productFile = path.join(dir, `product${path.extname(product)}`); await download(await fetchableUrl(product, ws), productFile).catch(() => { productFile = null; }); }
  const dur = (await probe(hostFile)).dur;
  // the words as heard, spelled as in the script («Creats» → «Creads»), then the customer's own corrections
  const heard = elevenlabs.configured() ? ((await elevenlabs.transcribe!(hostSrc, lang).catch(() => null))?.words ?? []) : [];
  const words = applyFixes(host!.guion ? respell(heard, host!.guion) : heard, p.correcciones ?? []);
  const prompt = (p.prompt ?? "").trim().slice(0, 160);
  const card = prompt ? await renderCard(dir, productFile, prompt) : null;
  const slots = planDemo(dur, ex.length, Boolean(card));
  const files: string[] = [];
  for (let i = 0; i < slots.length; i++) files.push(await renderSlot(dir, i, slots[i], hostFile, ex, card));
  const cierre = { titulo: p.cierre?.trim() ? p.cierre.trim().slice(0, 28) : "creadsia.com", linea: (p.linea ?? "").trim().slice(0, 48) };
  const r = await finishDemo(dir, files, hostFile, dur, demoAss(words, slots, dur, cierre));
  const url = await saveMedia(ws, "finals", await readFile(r.file), "video/mp4");
  return { url, seconds: r.seconds, host: { titulo: host!.titulo, guion: host!.guion, idioma: host!.idioma } };
}
