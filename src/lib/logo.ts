import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fetchableUrl, saveMedia } from "./media";
import type { Marca } from "./marca";

// Puts the brand's logo on a finished ad image (kit de marca). Deterministic, with FFmpeg: the AI never redraws
// a logo (it would change it). In 9:16 the logo stays out of the stories bars (top 14%, bottom 20%).

async function bytesOf(ref: string, ws: string) {
  const res = await fetch(await fetchableUrl(ref, ws, 600), { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error("No se pudo leer la imagen.");
  return new Uint8Array(await res.arrayBuffer());
}

export async function conLogo(ws: string, image: string, m: Marca, formato: "4:5" | "9:16"): Promise<string> {
  if (!m.logo || m.logoPos === "no") return image;
  const { ff } = await import("./montage");
  const id = randomUUID();
  const a = path.join("/tmp", `logo-${id}-a`), l = path.join("/tmp", `logo-${id}-l`), out = path.join("/tmp", `logo-${id}.jpg`);
  try {
    const [img, logo] = await Promise.all([bytesOf(image, ws), bytesOf(m.logo, ws)]);
    await Promise.all([writeFile(a, img), writeFile(l, logo)]);
    const left = m.logoPos.endsWith("izq"), top = m.logoPos.startsWith("arriba");
    const x = left ? "W*0.06" : "W-w-W*0.06";
    const y = formato === "9:16" ? (top ? "H*0.15" : "H-h-H*0.21") : (top ? "H*0.045" : "H-h-H*0.045");
    await ff(["-y", "-v", "error", "-nostdin", "-i", a, "-i", l, "-filter_complex",
      // ffmpeg-static 6: in scale2ref, iw/ih are the ad image and main_w/main_h the logo (checked 25 Oct 2026)
      `[1:v][0:v]scale2ref=w='iw*${formato === "9:16" ? 0.24 : 0.2}':h='iw*${formato === "9:16" ? 0.24 : 0.2}*main_h/main_w'[lg][bg];[bg][lg]overlay=x=${x}:y=${y}:format=auto`,
      "-frames:v", "1", "-q:v", "2", out], 60_000).catch(async () => {
      // older FFmpeg builds: simpler fixed-width logo
      await ff(["-y", "-v", "error", "-nostdin", "-i", a, "-i", l, "-filter_complex",
        `[1:v]scale=220:-1[lg];[0:v][lg]overlay=x=${x}:y=${y}`, "-frames:v", "1", "-q:v", "2", out], 60_000);
    });
    return await saveMedia(ws, "tandas", new Uint8Array(await readFile(out)), "image/jpeg");
  } finally {
    await Promise.all([rm(a, { force: true }), rm(l, { force: true }), rm(out, { force: true })]).catch(() => {});
  }
}
