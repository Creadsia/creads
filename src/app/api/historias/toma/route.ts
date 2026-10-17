import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { fullSession } from "@/lib/access";
import { findImage } from "@/lib/providers";
import { fetchableUrl, ownsMedia, saveMedia } from "@/lib/media";
import { serviceOfModel } from "@/lib/balances";
import { refundJob } from "@/lib/credits";
import { failMessage, failStatus, payFor } from "@/lib/paid";
import type { AspectRatio } from "@/lib/providers/types";
import { keyframePrompt } from "@/lib/historias";
import { loadStory } from "@/lib/historia-db";

export const maxDuration = 120;

// POST {adId, idx, image?, extra?}: draws the first frame of one shot from the character sheets (paid),
// or uses one of the customer's own images. A new frame means the shot's video must be made again.
export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const limited = await tooMany("gen", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const adId = String(b?.adId ?? "");
  const idx = Number(b?.idx);
  const found = await loadStory(s.db, adId).catch(() => null);
  if (!found) return NextResponse.json({ error: "Historia no encontrada." }, { status: 404 });
  const { ad, st } = found;
  const shot = st.plan.shots[idx];
  if (!shot) return NextResponse.json({ error: "Toma no encontrada." }, { status: 404 });
  const clip = (await s.db.list("clips", `ad_id=eq.${adId}&order=idx.asc`)).find((c) => Number(c.idx) === idx);
  if (!clip) return NextResponse.json({ error: "Toma no encontrada." }, { status: 404 });
  if (clip.status === "generating" || clip.status === "starting" || clip.status === "syncing") return NextResponse.json({ error: "Esta toma se está animando; espera que termine." }, { status: 409 });

  if (b?.image) {
    if (!ownsMedia(b.image, s.user.workspace)) return NextResponse.json({ error: "Esa imagen no es de tu cuenta." }, { status: 403 });
    // only if nobody started animating it meanwhile (that job would be lost)
    const row = await s.db.claim("clips", String(clip.id), { notIn: ["generating", "starting", "syncing"] }, { image_url: b.image, status: "pending", url: null, error: null });
    if (!row) return NextResponse.json({ error: "Esta toma se empezó a animar; espera que termine." }, { status: 409 });
    return NextResponse.json({ clip: row });
  }

  const missing = shot.characters.filter((k) => !st.plan.characters.find((c) => c.key === k)?.image_url);
  if (missing.length) return NextResponse.json({ error: "Primero crea los personajes de esta toma." }, { status: 400 });
  const provider = findImage("nano-banana-pro");
  if (!provider?.configured()) return NextResponse.json({ error: "La creación de imágenes no está disponible ahora. Vuelve a intentar en unos minutos." }, { status: 503 });
  const svc = serviceOfModel(provider.id);
  let ref = "";
  try {
    ref = (await payFor(s.user, provider.usdPerImage, `Historia · toma ${idx + 1}`, svc)).ref;
    const refs = await Promise.all(
      shot.characters.slice(0, 3).map(async (k) => ({ url: await fetchableUrl(st.plan.characters.find((c) => c.key === k)!.image_url!, s.user.workspace), role: "face" as const })),
    );
    const extra = typeof b?.extra === "string" && b.extra.trim() ? `\nCorrection requested by the director: ${b.extra.trim().slice(0, 300)}` : "";
    const aspect = String(ad.aspect || "9:16") as AspectRatio;
    const { bytes, mime } = await provider.generate({ prompt: keyframePrompt(shot, st.plan, st.style, aspect) + extra, aspect, refs });
    const url = await saveMedia(s.user.workspace, "historias", bytes, mime);
    const row = await s.db.claim("clips", String(clip.id), { notIn: ["generating", "starting", "syncing"] }, { image_url: url, status: "pending", url: null, error: null });
    if (!row) return NextResponse.json({ error: "La imagen se creó, pero la toma se empezó a animar mientras tanto. Cuando termine, usa «Rehacer imagen»." }, { status: 409 });
    return NextResponse.json({ clip: row, usd: provider.usdPerImage });
  } catch (err) {
    console.error("historias/toma", err instanceof Error ? err.message : err);
    if (ref) await refundJob(s.user.workspace, ref);
    return NextResponse.json({ error: await failMessage(err, s.user, svc) }, { status: failStatus(err) });
  }
}
