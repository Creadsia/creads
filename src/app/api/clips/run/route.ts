import { NextResponse } from "next/server";
import { tooMany } from "@/lib/rate";
import { SESSION_ENDED, session } from "@/lib/access";
import { findImage, findVideo } from "@/lib/providers";
import { PAUSED_TEXT, isPaused } from "@/lib/model-pause";
import { nanoBananaPro } from "@/lib/providers/gemini";
import type { AspectRatio, MediaRef } from "@/lib/providers/types";
import { fetchableUrl, saveMedia } from "@/lib/media";
import { serviceOfModel } from "@/lib/balances";
import { refundJob } from "@/lib/credits";
import { failMessage, failStatus, payFor } from "@/lib/paid";
import { type StorySettings, billedSeconds, lipsyncSeconds, lipsyncUsd, storyClipSeconds } from "@/lib/historias";
import { canUseVoice } from "@/lib/voices";
import { refusesFrame } from "@/lib/formats";

export const maxDuration = 120;

// Veo 3.1 and Veo 3.1 Fast take the face and product photos directly as references.
// Veo 3.1 (standard) takes the face and product photos directly; the rest start from a drawn opening frame.
const TAKES_REFS = new Set(["veo-3.1"]);

interface Settings {
  lang?: string;
  avatar?: { image_url?: string | null } | null;
  product?: { image_url?: string | null } | null;
  frames?: string[];
  voiceId?: string | null; // ads: the person's lines are recorded with this voice and lip-synced
}

/** Starts (or restarts) the generation of one clip. Spends money: the studio asks before calling it. */
export async function POST(req: Request) {
  const s = await session(req);
  if (!s) return NextResponse.json({ error: SESSION_ENDED }, { status: 401 });
  const limited = await tooMany("gen", s.user.id);
  if (limited) return limited;
  const { db } = s;
  const b = await req.json().catch(() => null);
  const id = String(b?.id ?? "");
  let charged = false;
  let before: string | null = null; // the clip's status before this attempt (put back if nothing was spent)
  try {
    const found = await db.get("clips", id);
    if (!found) return NextResponse.json({ error: "Corte no encontrado." }, { status: 404 });
    // Claim the clip atomically: a double click, a second tab or two parallel requests can't
    // start (and charge) the same clip twice.
    let clip = await db.claim("clips", id, { notIn: ["generating", "starting", "syncing"] }, { status: "starting" });
    // a start that died halfway stays "starting" until the status check clears it (after 5 minutes,
    // giving the credits back); only then can it start again
    if (!clip) return NextResponse.json({ error: found.status === "syncing" ? "Esta toma está poniendo la voz. Espera un momento." : found.status === "starting" ? "Este corte se está iniciando. Si en 5 minutos no avanza, se libera solo y puedes reintentarlo." : "Este corte ya se está generando." }, { status: 409 });
    before = found.status === "starting" || found.status === "syncing" ? "failed" : String(found.status ?? "pending");
    const giveBack = async (res: NextResponse) => { await db.update("clips", id, { status: before }).catch(() => {}); return res; };
    // Retry with another model (e.g. when one refuses the avatar's face).
    if (typeof b?.model === "string" && b.model && b.model !== clip.model) {
      const other = findVideo(b.model);
      if (!other?.configured() || other.silent) return giveBack(NextResponse.json({ error: "Ese modelo no sirve para este corte." }, { status: 400 }));
      clip = (await db.update("clips", id, { model: other.id })) ?? clip;
    }
    const ad = await db.get("ads", String(clip.ad_id));
    if (!ad) return giveBack(NextResponse.json({ error: "Anuncio no encontrado." }, { status: 404 }));
    const provider = findVideo(String(clip.model));
    if (!provider?.configured()) return giveBack(NextResponse.json({ error: "Ese modelo no está disponible ahora. Elige otro." }, { status: 503 }));
    if (await isPaused(provider.id)) return giveBack(NextResponse.json({ error: PAUSED_TEXT }, { status: 503 }));

    const st = (ad.settings ?? {}) as Settings;
    const ws = s.user.workspace;
    // the photos must be this customer's own files; outside services get a short-lived link
    const face = st.avatar?.image_url ? await fetchableUrl(st.avatar.image_url, ws) : "";
    const prod = st.product?.image_url ? await fetchableUrl(st.product.image_url, ws) : "";
    let aspect = String(ad.aspect || "9:16") as AspectRatio;
    if (provider.id.startsWith("veo") && aspect !== "16:9") aspect = "9:16";
    const words = String(clip.text || "").split(/\s+/).filter(Boolean).length;
    // Animated stories: each shot lasts what the plan says (the montage trims it); the picture is the
    // keyframe drawn from the character sheets, and the sound is the film's music, not the clip's.
    const story = ad.format === "historia" ? (ad.settings as StorySettings | null) : null;
    if (story && !clip.image_url) return giveBack(NextResponse.json({ error: "Primero crea la imagen de esta toma." }, { status: 400 }));
    const shotPlan = story?.plan?.shots?.[Number(clip.idx)];
    const talks = Boolean(shotPlan?.dialogue?.line?.trim()); // a character speaks: the clip keeps its voice
    // the speaker has their own voice (e.g. a cloned one): animate, then record the line and lip-sync it
    let ownVoice = talks ? story?.plan?.characters?.find((c) => c.key === shotPlan?.dialogue?.speaker)?.voiceId ?? null : null;
    if (!story && st.voiceId && String(clip.text ?? "").trim()) ownVoice = st.voiceId;
    if (ownVoice && !(await canUseVoice(ws, ownVoice))) ownVoice = null;
    const line = story ? shotPlan?.dialogue?.line ?? "" : String(clip.text ?? "").trim();
    // the recorded line must fit inside the clip the lip-sync works on (10 s at most; Veo makes 8 s)
    if (ownVoice && !story && line.trim().split(/\s+/).length / 2.2 + 1.5 > (provider.id.startsWith("veo") ? 8 : 10)) {
      return giveBack(NextResponse.json({ error: "Este corte es muy largo para ponerle tu voz (máximo unas 18 palabras). Divídelo en dos cortes en el paso 2. No se usaron créditos." }, { status: 400 }));
    }
    if (talks && !ownVoice && provider.silent) return giveBack(NextResponse.json({ error: `${provider.label} no genera voz. Para las tomas con diálogo elige Kling 3.0, Seedance o Veo.` }, { status: 400 }));
    // Seedance refuses real faces: say so now instead of charging and failing
    if (!story && refusesFrame(provider, String(ad.format ?? "ugc"), { face: Boolean(face), product: Boolean(prod) })) {
      return giveBack(NextResponse.json({ error: `${provider.label} no acepta fotos de personas reales (tu avatar, o una persona con tu producto). Elige Veo 3.1 Fast o Kling 3.0. No se usaron créditos.` }, { status: 400 }));
    }
    const asked = story ? storyClipSeconds(shotPlan, Boolean(ownVoice)) : ownVoice ? lipsyncSeconds(line) : Math.min(15, Math.max(4, Math.ceil(words / 2.7) + 1));
    // charge (and ask) for what the model really makes: its nearest allowed length
    const seconds = provider.id.startsWith("veo") ? asked : billedSeconds(asked, provider.durations);
    // Charge before spending anything (the opening frame below already costs).
    const takesRefs = TAKES_REFS.has(provider.id) && Boolean(face || prod);
    const needsFrame = !takesRefs && Boolean(face || prod) && !clip.image_url;
    const videoSecs = provider.id.startsWith("veo") ? (takesRefs ? 8 : seconds <= 4 ? 4 : seconds <= 6 ? 6 : 8) : seconds;
    // opening frames: Nano Banana 2 (US$0.08, same look and face from the photos) — Pro only as a fallback
    const nb2 = findImage("nano-banana-2");
    const frameModel = nb2?.configured() ? nb2 : nanoBananaPro;
    const estimate = provider.usdPerSecond * videoSecs + (needsFrame ? frameModel.usdPerImage : 0) + (ownVoice ? lipsyncUsd(videoSecs, line) : 0);
    // A free automatic redo uses the voucher the server-side review granted for this clip (if any).
    const freeRedoOf = b?.free === true && before === "done" ? String(ad.id) : undefined;
    await payFor(s.user, estimate, `${story ? "Toma" : "Corte"} ${Number(clip.idx) + 1} · ${provider.label}`, serviceOfModel(provider.id), { ref: id, freeRedoOf });
    charged = true; // paid or free, a failure below gives it back (a free redo gets its voucher back)

    let refs: MediaRef[] = [];
    let image = (clip.image_url as string | null) || "";
    if (TAKES_REFS.has(provider.id) && (face || prod)) {
      refs = [...(face ? [{ url: face, role: "face" as const }] : []), ...(prod ? [{ url: prod, role: "product" as const }] : [])];
    } else if ((face || prod) && !image) {
      // Models that animate a still: first draw the opening frame from the photos (Nano Banana 2; Pro if it fails).
      const framePrompt = st.frames?.[Number(clip.idx)] || String(clip.prompt).slice(0, 1500);
      const frameReq = {
        prompt: framePrompt,
        aspect,
        refs: [...(face ? [{ url: face, role: "face" as const }] : []), ...(prod ? [{ url: prod, role: "product" as const }] : [])],
      };
      const ff = await frameModel.generate(frameReq).catch((e) => (frameModel === nanoBananaPro ? Promise.reject(e) : nanoBananaPro.generate(frameReq)));
      image = await saveMedia(ws, "frames", ff.bytes, ff.mime);
    }
    if (image && !refs.length) refs = [{ url: await fetchableUrl(image, ws), role: "first_frame" }];

    // story shots: sound only where a character speaks with the model's voice, or for the scene's
    // ambient sound when the story keeps it (the price is the same: we always charge the audio rate)
    const job = await provider.submit({ prompt: String(clip.prompt), seconds, aspect, resolution: "720p", withAudio: !story || (talks && !ownVoice) || Boolean(story.ambient && !talks), refs });
    const usd = +(provider.usdPerSecond * (provider.id.startsWith("veo") ? (refs.some((r) => r.role !== "first_frame") ? 8 : seconds <= 4 ? 4 : seconds <= 6 ? 6 : 8) : seconds)).toFixed(3);
    // what was paid for travels with the clip: the lip-sync step reads it from here, not from the
    // story (which the customer may edit while the clip renders)
    const extra = story ? { kind: ownVoice ? `shot:ls:${ownVoice}` : "shot", text: talks ? shotPlan!.dialogue!.line : clip.text } : ownVoice ? { kind: `ad:ls:${ownVoice}` } : {};
    const row = await db.update("clips", id, { provider_job: job.jobId, status: "generating", image_url: image || null, error: null, url: null, usd, ...extra });
    // redoing a cut of a finished ad puts it back in «En producción» (its last final video stays in
    // «Anuncios terminados» until it's rebuilt)
    if (ad.status === "done" || ad.status === "failed") await db.update("ads", String(ad.id), { status: "generating" }).catch(() => {});
    return NextResponse.json({ clip: row });
  } catch (err) {
    if (charged) await refundJob(s.user.workspace, id);
    const msg = await failMessage(err, s.user);
    if (!charged && before) {
      // nothing was spent (no credits, daily limit, provider without balance): a finished clip stays finished
      await db.update("clips", id, before === "done" ? { status: "done", error: msg.slice(0, 500) } : { status: "failed", error: msg.slice(0, 500) }).catch(() => {});
    } else if (before !== null) {
      await db.update("clips", id, { status: "failed", error: msg.slice(0, 500) }).catch(() => {});
    }
    return NextResponse.json({ error: msg }, { status: failStatus(err) });
  }
}
