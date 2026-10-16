import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { findVideo } from "@/lib/providers";
import { nanoBananaPro } from "@/lib/providers/gemini";
import type { AspectRatio, MediaRef } from "@/lib/providers/types";
import { fetchableUrl, saveMedia } from "@/lib/media";

export const maxDuration = 120;

// Veo 3.1 and Veo 3.1 Fast take the face and product photos directly as references.
const TAKES_REFS = new Set(["veo-3.1", "veo-3.1-fast"]);

interface Settings {
  lang?: string;
  avatar?: { image_url?: string | null } | null;
  product?: { image_url?: string | null } | null;
  frames?: string[];
}

/** Starts (or restarts) the generation of one clip. Spends money: the studio asks before calling it. */
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const { db } = s;
  const b = await req.json().catch(() => null);
  const id = String(b?.id ?? "");
  try {
    const clip = await db.get("clips", id);
    if (!clip) return NextResponse.json({ error: "Corte no encontrado." }, { status: 404 });
    const ad = await db.get("ads", String(clip.ad_id));
    if (!ad) return NextResponse.json({ error: "Anuncio no encontrado." }, { status: 404 });
    const provider = findVideo(String(clip.model));
    if (!provider?.configured()) return NextResponse.json({ error: "Ese modelo no está conectado." }, { status: 503 });

    const st = (ad.settings ?? {}) as Settings;
    const ws = s.user.workspace;
    // the photos must be this customer's own files; outside services get a short-lived link
    const face = st.avatar?.image_url ? await fetchableUrl(st.avatar.image_url, ws) : "";
    const prod = st.product?.image_url ? await fetchableUrl(st.product.image_url, ws) : "";
    let aspect = String(ad.aspect || "9:16") as AspectRatio;
    if (provider.id.startsWith("veo") && aspect !== "16:9") aspect = "9:16";
    const words = String(clip.text || "").split(/\s+/).filter(Boolean).length;
    const seconds = Math.min(15, Math.max(4, Math.ceil(words / 2.7) + 1));

    let refs: MediaRef[] = [];
    let image = (clip.image_url as string | null) || "";
    if (TAKES_REFS.has(provider.id) && (face || prod)) {
      refs = [...(face ? [{ url: face, role: "face" as const }] : []), ...(prod ? [{ url: prod, role: "product" as const }] : [])];
    } else if ((face || prod) && !image) {
      // Models that animate a still: first draw the opening frame with Nano Banana Pro from the photos.
      const framePrompt = st.frames?.[Number(clip.idx)] || String(clip.prompt).slice(0, 1500);
      const ff = await nanoBananaPro.generate({
        prompt: framePrompt,
        aspect,
        refs: [...(face ? [{ url: face, role: "face" as const }] : []), ...(prod ? [{ url: prod, role: "product" as const }] : [])],
      });
      image = await saveMedia(ws, "frames", ff.bytes, ff.mime);
    }
    if (image && !refs.length) refs = [{ url: await fetchableUrl(image, ws), role: "first_frame" }];

    const job = await provider.submit({ prompt: String(clip.prompt), seconds, aspect, resolution: "720p", withAudio: true, refs });
    const usd = +(provider.usdPerSecond * (provider.id.startsWith("veo") ? (refs.some((r) => r.role !== "first_frame") ? 8 : seconds <= 4 ? 4 : seconds <= 6 ? 6 : 8) : seconds)).toFixed(3);
    const row = await db.update("clips", id, { provider_job: job.jobId, status: "generating", image_url: image || null, error: null, url: null, usd });
    return NextResponse.json({ clip: row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "No se pudo iniciar el corte.";
    await db.update("clips", id, { status: "failed", error: msg.slice(0, 500) }).catch(() => {});
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
