import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ff } from "./montage";
import { type Diseno, type FormatoPieza } from "./control-imagen";
import { FONTS_DIR } from "./fuente-metricas";
import { assPieza, layoutPieza } from "./pieza-texto";

// Burns the overlay (headline, button, logo) on a clean picture with FFmpeg, in one pass: the picture is
// cropped to the exact Meta size of the format (cover), the logo is fitted in its slot, then libass draws the
// text with the fonts in assets/fonts. Free: no AI involved, so text/layout edits only re-run this.

const esc = (p: string) => p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");

export async function renderPieza(imagen: Uint8Array, d: Diseno, f: FormatoPieza, logo?: Uint8Array | null) {
  const L = layoutPieza(d, f);
  const dir = await mkdtemp(path.join(tmpdir(), "pieza-"));
  try {
    const img = path.join(dir, "in"), ass = path.join(dir, "t.ass"), out = path.join(dir, "out.jpg"), lg = path.join(dir, "logo");
    await writeFile(img, imagen);
    await writeFile(ass, assPieza(d, L));
    const base = `[0:v]scale=${L.W}:${L.H}:force_original_aspect_ratio=increase,crop=${L.W}:${L.H},setsar=1,format=rgba[b0]`;
    const text = `ass=filename='${esc(ass)}':fontsdir='${esc(FONTS_DIR)}'`;
    const args = ["-y", "-v", "error", "-nostdin", "-i", img];
    let graph: string;
    if (L.logo && logo?.length) {
      await writeFile(lg, logo);
      args.push("-i", lg);
      const b = L.logo;
      const x = d.logoPos === "arriba-izq" ? `${b.x}` : d.logoPos === "arriba-der" ? `${b.x + b.w}-w` : `${b.x + b.w / 2}-w/2`;
      const y = d.logoPos === "abajo" ? `${b.y + b.h}-h` : `${b.y}`;
      graph = `${base};[1:v]scale=${b.w}:${b.h}:force_original_aspect_ratio=decrease,format=rgba[lg];[b0][lg]overlay=x=${x}:y=${y}:format=auto[b1];[b1]${text},format=yuvj420p[o]`;
    } else {
      graph = `${base};[b0]${text},format=yuvj420p[o]`;
    }
    args.push("-filter_complex", graph, "-map", "[o]", "-frames:v", "1", "-q:v", "2", out);
    await ff(args, 60_000);
    return { bytes: new Uint8Array(await readFile(out)), layout: L };
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
