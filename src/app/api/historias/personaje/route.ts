import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { fullSession } from "@/lib/access";
import { findImage } from "@/lib/providers";
import { fetchableUrl, ownsMedia, saveMedia } from "@/lib/media";
import { serviceOfModel } from "@/lib/balances";
import { refundJob } from "@/lib/credits";
import { failMessage, failStatus, payFor } from "@/lib/paid";
import { avatarCharacterPrompt, characterPrompt } from "@/lib/historias";
import { loadStory, updateStory } from "@/lib/historia-db";

export const maxDuration = 120;

// POST {adId, key, image?, avatarId?, extra?}: draws a character's reference sheet (paid), or uses the
// customer's own picture when `image` is one of their files. `avatarId`: the character is one of the
// customer's avatars (their photo becomes the character, in the film's style). `extra` adds a correction.
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
    await updateStory(s.db, adId, (x) => { const y = x.plan.characters.find((k) => k.key === key); if (y) y.image_url = b.image; });
    return NextResponse.json({ character: { ...c, image_url: b.image } });
  }

  // one of the customer's avatars (their own row, so their own photo and consent)
  const avatar = typeof b?.avatarId === "string" ? await s.db.get("avatars", b.avatarId).catch(() => null) : null;
  if (b?.avatarId && !avatar?.image_url) return NextResponse.json({ error: "Ese avatar no tiene foto." }, { status: 400 });
  const provider = findImage("nano-banana-pro");
  if (!provider?.configured()) return NextResponse.json({ error: "La creación de imágenes no está disponible ahora. Vuelve a intentar en unos minutos." }, { status: 503 });
  const svc = serviceOfModel(provider.id);
  let ref = "";
  try {
    ref = (await payFor(s.user, provider.usdPerImage, `Historia · personaje ${c.name}`, svc)).ref;
    const extra = typeof b?.extra === "string" && b.extra.trim() ? `\nCorrection requested by the director: ${b.extra.trim().slice(0, 300)}` : "";
    // when redoing, the previous sheet guides the new one (same character, with the correction)
    let prompt = characterPrompt(c, st.style);
    let refs = extra && c.image_url ? [{ url: await fetchableUrl(c.image_url, s.user.workspace), role: "face" as const }] : [];
    if (avatar?.image_url) {
      prompt = avatarCharacterPrompt(c, st.style);
      refs = [{ url: await fetchableUrl(String(avatar.image_url), s.user.workspace), role: "face" as const }];
      c.avatar = String(avatar.id);
    }
    const { bytes, mime } = await provider.generate({ prompt: prompt + extra, aspect: "16:9", refs });
    const url = await saveMedia(s.user.workspace, "historias", bytes, mime);
    const avatarVoice = avatar && typeof avatar.voice_id === "string" ? avatar.voice_id : "";
    await updateStory(s.db, adId, (x) => {
      const y = x.plan.characters.find((k) => k.key === key);
      if (!y) return;
      y.image_url = url;
      if (avatar) y.avatar = String(avatar.id);
      // the avatar's voice (e.g. its clone) becomes the character's voice, unless one was chosen already
      if (avatarVoice && !y.voiceId) y.voiceId = avatarVoice;
    });
    c.image_url = url;
    return NextResponse.json({ character: c, usd: provider.usdPerImage });
  } catch (err) {
    console.error("historias/personaje", err instanceof Error ? err.message : err);
    if (ref) await refundJob(s.user.workspace, ref);
    return NextResponse.json({ error: await failMessage(err, s.user, svc) }, { status: failStatus(err) });
  }
}
