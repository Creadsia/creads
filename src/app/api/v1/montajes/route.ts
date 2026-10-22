import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { session, SESSION_ENDED } from "@/lib/access";
import { tooMany } from "@/lib/rate";
import { loadAd, publicAd, saveFinishedAd } from "@/lib/api-ads";
import { download, probe, workdir } from "@/lib/montage";
import { fetchableUrl, ownsMedia, saveMedia } from "@/lib/media";
import { elevenlabs } from "@/lib/providers/elevenlabs";
import { mediaRef } from "@/lib/mcp";
import { publicError } from "@/lib/public-error";
import { demoAss, finishDemo, planDemo, renderCard, renderSlot } from "@/lib/demo-montage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST {presentador: ad_…, ejemplos: [ad_…] (2–6), producto?: image link, prompt?: text, titulo?, cierre?, linea?}
// → «Demo con presentador»: the presenter's ad with the example ads in split screen / full screen, the
// «producto + prompt» card, word-by-word captions and a closing card. All the ads must be this account's and
// «listo». Free: the clips were paid when they were made. Answers with a new ad, already «listo».
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("ai", s.user.id);
  if (limited) return limited;
  const ws = s.user.workspace;
  const b = (await req.json().catch(() => null)) ?? {};
  const ids: string[] = Array.isArray(b.ejemplos) ? b.ejemplos.filter((x: unknown) => typeof x === "string").slice(0, 6) : [];
  if (typeof b.presentador !== "string" || ids.length < 2) return NextResponse.json({ error: "Manda «presentador» (el id del anuncio del presentador) y al menos 2 «ejemplos»." }, { status: 400 });
  const host = await loadAd(ws, b.presentador);
  const exs = await Promise.all(ids.map((id) => loadAd(ws, id)));
  const notReady = [host, ...exs].find((x) => !x || x.estado !== "listo" || !x.videoUrl);
  if (notReady !== undefined) return NextResponse.json({ error: "Todos los anuncios tienen que ser de esta cuenta y estar listos." }, { status: 409 });
  const product = typeof b.producto === "string" && b.producto ? mediaRef(b.producto) : null;
  if (product && (!ownsMedia(product, ws) || !/\.(png|jpe?g|webp)$/i.test(product))) return NextResponse.json({ error: "La foto del producto tiene que ser una imagen de esta cuenta." }, { status: 400 });
  const prompt = typeof b.prompt === "string" ? b.prompt.trim().slice(0, 160) : "";
  const lang = host!.idioma === "en" ? "en" : "es";

  try {
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
    const words = elevenlabs.configured() ? ((await elevenlabs.transcribe!(hostSrc, lang).catch(() => null))?.words ?? []) : [];
    const card = prompt ? await renderCard(dir, productFile, prompt) : null;
    const slots = planDemo(dur, ex.length, Boolean(card));
    const files: string[] = [];
    for (let i = 0; i < slots.length; i++) files.push(await renderSlot(dir, i, slots[i], hostFile, ex, card));
    const cierre = { titulo: typeof b.cierre === "string" && b.cierre.trim() ? b.cierre.trim().slice(0, 28) : "creadsia.com", linea: typeof b.linea === "string" ? b.linea.trim().slice(0, 48) : "" };
    const r = await finishDemo(dir, files, hostFile, dur, demoAss(words, slots, dur, cierre));
    const url = await saveMedia(ws, "finals", await readFile(r.file), "video/mp4");
    // also in the studio's «Anuncios terminados» (a missing table never loses the video)
    await s.db.insert("ads", { title: (typeof b.titulo === "string" && b.titulo.trim() ? b.titulo.trim() : `Demo · ${host!.titulo}`).slice(0, 120), format: "ugc", aspect: "9:16", status: "done", final_url: url, settings: { demo: true } }).catch((e: unknown) => console.error("montajes ads row", e instanceof Error ? e.message : e));
    const job = await saveFinishedAd(ws, s.user.id, {
      titulo: (typeof b.titulo === "string" && b.titulo.trim() ? b.titulo.trim() : `Demo · ${host!.titulo}`).slice(0, 80),
      guion: host!.guion, idioma: host!.idioma, videoUrl: url, formato: "demo",
    });
    return NextResponse.json({ anuncio: publicAd(job), segundos: Math.round(r.seconds * 10) / 10 });
  } catch (err) {
    console.error("montajes", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: publicError(err, "No se pudo armar el video. Intenta de nuevo en un momento.") }, { status: 502 });
  }
}
