import { NextResponse } from "next/server";
import { SESSION_ENDED, session } from "@/lib/access";
import { DbError } from "@/lib/db";
import { findVideo } from "@/lib/providers";
import { UNAVAILABLE as UNAVAILABLE_TEXT, publicError } from "@/lib/public-error";
import { cleanNiche } from "@/lib/niches";
import { defaultVoice, resolveVoice } from "@/lib/voices";
import { ownsMedia } from "@/lib/media";
import { takesOwnVoice } from "@/lib/formats";
import { avatarVideo } from "@/lib/avatar-video";
import { isOwner } from "@/lib/auth";

// Creates an ad and one clip per cut, ready to be generated (step 4 of "Crear anuncio").
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const { db } = s;
  const b = await req.json().catch(() => null);
  const clips: { tipo: string; texto: string; prompt: string; framePrompt?: string; segundos?: number }[] = Array.isArray(b?.clips) ? b.clips.slice(0, 12) : [];
  const model = findVideo(String(b?.model ?? ""));
  if (!clips.length || clips.some((c) => !c?.prompt || !c?.texto)) return NextResponse.json({ error: "Faltan las escenas." }, { status: 400 });
  if (!model) return NextResponse.json({ error: "Elige un modelo de video." }, { status: 400 });
  // the owner sees which model and why (a customer only sees the calm message)
  if (!model.configured()) return NextResponse.json({ error: isOwner(s.user) ? `El modelo «${model.label}» no está configurado: falta su clave en Vercel.` : UNAVAILABLE_TEXT }, { status: 503 });

  try {
    const [avatar, product] = await Promise.all([
      b?.avatarId ? db.get("avatars", String(b.avatarId)) : null,
      b?.productId ? db.get("products", String(b.productId)) : null,
    ]);
    // The person's lines recorded with a chosen voice (ElevenLabs) and lip-synced, instead of the voice the
    // video model makes up (which stumbles on Spanish words and brand names). The studio sends the choice
    // ("" = the model's voice); the API and connectors default to the avatar's own voice.
    const format = String(b?.format ?? "ugc");
    const lang = b?.lang === "es-CL" ? "es-CL" : "en";
    const wanted = typeof b?.voiceId === "string" ? b.voiceId : null; // null = not chosen (API): the avatar's or a matching accent voice
    let voiceId: string | null = null;
    if (takesOwnVoice(format)) {
      let why = "";
      voiceId = wanted === null
        ? await defaultVoice(s.user.workspace, avatar, lang).catch((e) => { console.error("ads/start default voice", e instanceof Error ? e.message : e); return null; })
        : wanted ? await resolveVoice(s.user.workspace, wanted).catch((e) => { why = e instanceof Error ? e.message : ""; console.error("ads/start voice", why); return null; }) : null;
      // Creadsia's team sees ElevenLabs' real reason (to fix it fast); customers a calm message
      if (wanted && !voiceId) return NextResponse.json({ error: `Esa voz no está disponible. Elige otra.${s.user.workspace === "main" && why ? ` (${why.slice(0, 200)})` : ""}` }, { status: 400 });
    }
    // «Persona real»: the avatar's own filmed video gets the voice on its lips; it needs both
    const video = avatar ? avatarVideo(avatar.notes) : null;
    if (model.actor && (!video || !ownsMedia(video, s.user.workspace))) return NextResponse.json({ error: "Este avatar no tiene su video. Súbelo en Avatares (Persona real) o elige otro modelo." }, { status: 400 });
    if (model.actor && !voiceId) return NextResponse.json({ error: "Persona real necesita una voz: elígela y grábala en el paso Voz." }, { status: 400 });
    // «Boca natural» (sync.so sync-3) instead of the fast lip-sync: the most natural mouth, a bit more expensive
    const lipsync = voiceId && b?.lipsync === "pro" ? "pro" : null;
    // the voice the customer already heard and approved, one recording per cut (the video is lip-synced to it)
    const audios = voiceId && Array.isArray(b?.audios) ? clips.map((_, i) => (ownsMedia(b.audios[i], s.user.workspace) ? String(b.audios[i]) : null)) : null;
    const ad = await db.insert("ads", {
      title: String(b?.title ?? "Anuncio").slice(0, 120),
      script_id: b?.scriptId || null,
      format,
      aspect: String(b?.aspect ?? "9:16"),
      model: model.id,
      status: "generating",
      settings: {
        lang,
        niche: cleanNiche(b?.niche) || null,
        avatar: avatar ? { id: avatar.id, name: avatar.name, image_url: avatar.image_url, voice_id: avatar.voice_id, ...(video ? { video } : {}) } : null,
        product: product ? { id: product.id, name: product.name, image_url: product.image_url } : null,
        voiceId,
        lipsync,
        audios,
        // seconds the customer chose per cut (or the length of its recorded voice): no filler the AI makes up
        secs: clips.map((c) => (Number.isFinite(Number(c.segundos)) && Number(c.segundos) > 0 ? Math.min(15, Math.max(2, Math.round(Number(c.segundos)))) : null)),
      },
    });
    const rows = [];
    for (let i = 0; i < clips.length; i++) {
      rows.push(await db.insert("clips", {
        ad_id: ad.id, idx: i, kind: clips[i].tipo, text: clips[i].texto, prompt: clips[i].prompt,
        model: model.id, status: "pending",
      }));
    }
    // Keep the first-frame prompt per clip in the ad settings (used by /api/clips/run).
    await db.update("ads", String(ad.id), { settings: { ...(ad.settings as object), frames: clips.map((c) => c.framePrompt ?? "") } });
    return NextResponse.json({ ad, clips: rows });
  } catch (err) {
    const msg = publicError(err, "No se pudo crear el anuncio.");
    return NextResponse.json({ error: msg, missingTable: err instanceof DbError && err.missingTable }, { status: 502 });
  }
}
