import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { fullSession } from "@/lib/access";
import { findImage } from "@/lib/providers";
import { fetchableUrl, ownsMedia, saveMedia } from "@/lib/media";
import { serviceOfModel } from "@/lib/balances";
import { refundJob } from "@/lib/credits";
import { failMessage, failStatus, payFor } from "@/lib/paid";
import { characterPrompt } from "@/lib/historias";
import { loadStory, saveSettings } from "@/lib/historia-db";

export const maxDuration = 120;

// POST {adId, key, image?, extra?}: draws a character's reference sheet (paid), or uses the
// customer's own picture when `image` is one of their files. `extra` adds a correction ("más joven").
export async function POST(req: Request) {
  const s = await fullSession(req);
  if (s instanceof NextResponse) return s;
  const limited = await tooMany("gen", s.user.id);
  if (limited) return limited;
  const b = await req.json().catch(() => null);
  const adId = String(b?.adId ?? "");
  const key = String(b?.key ?? "");
  const found = await loadStory(s.db, adId).catch(() => null);
  if (!found) return NextResponse.json({ error: "Historia no encontrada." }, { status: 404 });
  const { st } = found;
  const c = st.plan.characters.find((x) => x.key === key);
  if (!c) return NextResponse.json({ error: "Personaje no encontrado." }, { status: 404 });

  if (b?.image) {
    if (!ownsMedia(b.image, s.user.workspace)) return NextResponse.json({ error: "Esa imagen no es de tu cuenta." }, { status: 403 });
    c.image_url = b.image;
    await saveSettings(s.db, adId, st);
    return NextResponse.json({ character: c });
  }

  const provider = findImage("nano-banana-pro");
  if (!provider?.configured()) return NextResponse.json({ error: "Nano Banana Pro no está conectado." }, { status: 503 });
  const svc = serviceOfModel(provider.id);
  let ref = "";
  try {
    ref = (await payFor(s.user, provider.usdPerImage, `Historia · personaje ${c.name}`, svc)).ref;
    const extra = typeof b?.extra === "string" && b.extra.trim() ? `\nCorrection requested by the director: ${b.extra.trim().slice(0, 300)}` : "";
    // when redoing, the previous sheet guides the new one (same character, with the correction)
    const refs = extra && c.image_url ? [{ url: await fetchableUrl(c.image_url, s.user.workspace), role: "face" as const }] : [];
    const { bytes, mime } = await provider.generate({ prompt: characterPrompt(c, st.style) + extra, aspect: "16:9", refs });
    c.image_url = await saveMedia(s.user.workspace, "historias", bytes, mime);
    await saveSettings(s.db, adId, st);
    return NextResponse.json({ character: c, usd: provider.usdPerImage });
  } catch (err) {
    console.error("historias/personaje", err instanceof Error ? err.message : err);
    if (ref) await refundJob(s.user.workspace, ref);
    return NextResponse.json({ error: await failMessage(err, s.user, svc) }, { status: failStatus(err) });
  }
}
