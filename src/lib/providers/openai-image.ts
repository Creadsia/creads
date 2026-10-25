import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AspectRatio, ImageProvider, ImageRequest } from "./types";
import { fetchRetry } from "./retry";

// OpenAI GPT Image 2.5 (the family behind ChatGPT Images since Sep 2026), for ad images: strongest at following
// the brief and at text inside the picture (headlines, prices, signs). Owner, 23 Oct 2026. Needs
// OPENAI_API_KEY in Vercel. Two versions: «Flare» (fast, medium quality) and «Sunburst» (precise, high quality).
// GPT Image only draws 1024×1024, 1024×1536 and 1536×1024: 9:16, 4:5 and 16:9 are cut from the nearest one
// (centre crop with FFmpeg), so they fit the ad formats exactly.

const API = "https://api.openai.com/v1";
const key = () => {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error("Falta OPENAI_API_KEY en Vercel.");
  return k;
};

/** The size GPT Image draws for an aspect, and the crop that turns it into that aspect (null: no crop). */
export function sizeFor(aspect: AspectRatio): { size: string; crop: string | null } {
  if (aspect === "1:1") return { size: "1024x1024", crop: null };
  if (aspect === "16:9") return { size: "1536x1024", crop: "crop=1536:864" };
  if (aspect === "4:5") return { size: "1024x1536", crop: "crop=1024:1280" };
  return { size: "1024x1536", crop: "crop=864:1536" }; // 9:16
}

async function fail(res: Response, what: string): Promise<never> {
  const body = await res.json().catch(() => null);
  const e = body?.error ?? {};
  const msg = String(e.message ?? res.statusText);
  if (e.code === "moderation_blocked" || /safety|moderation/i.test(msg)) {
    throw new Error(`${what} no dibujó esta imagen porque choca con sus reglas de seguridad (personas famosas, marcas, armas, violencia o menores en situaciones delicadas). Cambia la descripción y vuelve a intentarlo. No se usaron tus créditos.`);
  }
  if (/verif/i.test(msg)) throw new Error(`${what}: OpenAI pide verificar la organización antes de usar sus modelos de imagen (platform.openai.com → Settings → Organization → Verify). (código ${res.status})`);
  throw new Error(`${what}: ${msg.slice(0, 300)} (código ${res.status})`);
}

async function cut(bytes: Uint8Array, crop: string | null): Promise<{ bytes: Uint8Array; mime: string }> {
  if (!crop) return { bytes, mime: "image/png" };
  const { ff } = await import("../montage");
  const id = randomUUID();
  const a = path.join("/tmp", `gpti-${id}.png`), b = path.join("/tmp", `gpti-${id}-c.png`);
  // the server's /tmp is small and shared by every request on a warm instance: always clean up (a long batch
  // filled it once, 25 Oct 2026: «no space left on device» after the images were already paid for)
  try {
    await writeFile(a, bytes);
    await ff(["-y", "-v", "error", "-nostdin", "-i", a, "-vf", crop, "-frames:v", "1", b], 60_000);
    return { bytes: new Uint8Array(await readFile(b)), mime: "image/png" };
  } finally {
    await Promise.all([rm(a, { force: true }), rm(b, { force: true })]).catch(() => {});
  }
}

function gptImage(o: { id: string; label: string; model: string; quality: string; usd: number }): ImageProvider {
  return {
    id: o.id,
    label: o.label,
    usdPerImage: o.usd,
    configured: () => Boolean(process.env.OPENAI_API_KEY),
    async generate({ prompt, aspect, refs }: ImageRequest) {
      const { size, crop } = sizeFor(aspect);
      // the sides (or top/bottom) are cut afterwards: ask for a safe margin so no word or button is lost
      if (crop) prompt = `${prompt}\n\nComposition: the image will be trimmed ${size === "1536x1024" ? "at the top and bottom" : "on the left and right"} by about 10%, so keep every word, number, button and important object well inside the centre, never near ${size === "1536x1024" ? "the top or bottom edge" : "the side edges"}.`;
      let res: Response;
      if (refs?.length) {
        // with references (the face, the product): the edits endpoint takes them as images
        const form = new FormData();
        form.append("model", o.model);
        form.append("prompt", prompt);
        form.append("size", size);
        form.append("quality", o.quality);
        for (const [i, r] of refs.slice(0, 8).entries()) {
          const got = await fetch(r.url, { signal: AbortSignal.timeout(30_000) });
          if (!got.ok) continue;
          const type = (got.headers.get("content-type") ?? "image/png").split(";")[0];
          form.append("image[]", new Blob([await got.arrayBuffer()], { type }), `ref-${i}.${type.split("/")[1] ?? "png"}`);
        }
        res = await fetchRetry(`${API}/images/edits`, { method: "POST", headers: { authorization: `Bearer ${key()}` }, body: form, signal: AbortSignal.timeout(240_000) });
      } else {
        res = await fetchRetry(`${API}/images/generations`, {
          method: "POST",
          headers: { authorization: `Bearer ${key()}`, "content-type": "application/json" },
          body: JSON.stringify({ model: o.model, prompt, size, quality: o.quality, n: 1 }),
          signal: AbortSignal.timeout(240_000),
        });
      }
      if (!res.ok) return fail(res, o.label);
      const data = await res.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (typeof b64 !== "string") throw new Error(`${o.label} no devolvió imagen.`);
      return cut(Buffer.from(b64, "base64"), crop);
    },
  };
}

export const openaiImageProviders: ImageProvider[] = [
  // ≈ US$0.04–0.05 per image at medium (OpenAI's estimate for GPT Image 2 tokens; 2.5 uses the same rates): charged at 0.06
  gptImage({ id: "gpt-image-2.5", label: "GPT Image 2.5", model: "gpt-image-2.5-flare", quality: "medium", usd: 0.06 }),
  // high quality ≈ US$0.17–0.21: charged at 0.22
  gptImage({ id: "gpt-image-2.5-pro", label: "GPT Image 2.5 Pro (máxima calidad)", model: "gpt-image-2.5-sunburst", quality: "high", usd: 0.22 }),
];
