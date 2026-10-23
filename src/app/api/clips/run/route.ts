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
import { type StorySettings, billedSeconds, lipsyncProUsd, lipsyncSecondsTight, lipsyncUsd, storyClipSeconds } from "@/lib/historias";
import { canUseVoice } from "@/lib/voices";
import { elevenlabs } from "@/lib/providers/elevenlabs";
import { refusesFrame } from "@/lib/formats";
import { actorOffset } from "@/lib/avatar-video";
import { download, ff, probe, workdir } from "@/lib/montage";
import path from "node:path";
import { readFile } from "node:fs/promises";

export const maxDuration = 300; // «Persona real» downloads and cuts the person's video first

// Veo 3.1 and Veo 3.1 Fast take the face and product photos directly as references.
const TAKES_REFS = new Set(["veo-3.1", "veo-3.1-fast"]);

interface Settings {
  lang?: string;
  avatar?: { image_url?: string | null; video?: string | null } | null;
  product?: { image_url?: string | null } | null;
  frames?: string[];
  voiceId?: string | null; // ads: the person's lines are recorded with this voice and lip-synced
  voiceSpeed?: number; // ads: faster voice (1.0–1.2)
  lipsync?: "pro" | null; // ads: the most natural lip-sync (sync.so sync-3)
  audios?: (string | null)[]; // ads: the approved recording of each cut (step «Voz»)
  secs?: (number | null)[]; // ads: seconds chosen per cut
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
    if (talks && !ownVoice && provider.silent) return giveBack(NextResponse.json({ error: `${provider.label} no genera voz. Para las tomas con diálogo elige Kling 3.0, Seedance o Veo.` }, { status: 400 }));
    // Seedance refuses real faces: say so now instead of charging and failing
    if (!story && refusesFrame(provider, String(ad.format ?? "ugc"), { face: Boolean(face), product: Boolean(prod) })) {
      return giveBack(NextResponse.json({ error: `${provider.label} no acepta fotos de personas reales (tu avatar, o una persona con tu producto). Elige Veo 3.1 Fast o Kling 3.0. No se usó tu saldo.` }, { status: 400 }));
    }
    // «Avatar que habla» (Kling Avatar): the presenter's picture talks with the approved voice, in one step
    const talking = !story && Boolean(provider.talking);
    if (talking && !ownVoice) return giveBack(NextResponse.json({ error: `${provider.label} necesita una voz: elígela y grábala en el paso Voz. No se usó tu saldo.` }, { status: 400 }));
    if (talking && !face && !clip.image_url) return giveBack(NextResponse.json({ error: `${provider.label} necesita un avatar (la foto de quien habla). Elígelo en Escenas. No se usó tu saldo.` }, { status: 400 }));
    // «Persona real»: the person's own filmed video with the approved voice on their lips (no generation)
    const actor = !story && Boolean(provider.actor);
    const actorVideo = actor ? String(st.avatar?.video ?? "") : "";
    if (actor && !ownVoice) return giveBack(NextResponse.json({ error: `${provider.label} necesita una voz: elígela y grábala en el paso Voz. No se usó tu saldo.` }, { status: 400 }));
    if (actor && !actorVideo) return giveBack(NextResponse.json({ error: "Este avatar no tiene su video. Súbelo en Avatares (Persona real) o elige otro modelo. No se usó tu saldo." }, { status: 400 }));
    // an ad cut with a recorded voice and no seconds chosen (API, connector): as long as the voice will be
    // (~2.7 words a second in Chilean Spanish), not a generous guess that pays for seconds that get cut off;
    // the lip-sync stretches the video if the voice runs a little longer (sync_mode "bounce")
    const voiceSecs = lipsyncSecondsTight(line);
    const talkSecs = Math.min(15, Math.max(3, Math.ceil(line.split(/\s+/).filter(Boolean).length / 2.4 + 0.8)));
    const chosen = !story && !talking && !actor ? st.secs?.[Number(clip.idx)] ?? null : null;
    const asked = talking || actor ? talkSecs : chosen ? chosen : story ? storyClipSeconds(shotPlan, Boolean(ownVoice)) : ownVoice ? voiceSecs : Math.min(15, Math.max(4, Math.ceil(words / 2.7) + 1));
    // charge (and ask) for what the model really makes: its nearest allowed length
    const seconds = provider.id.startsWith("veo") ? asked : billedSeconds(asked, provider.durations);
    // Charge before spending anything (the opening frame below already costs).
    const takesRefs = TAKES_REFS.has(provider.id) && Boolean(face || prod);
    const needsFrame = !takesRefs && Boolean(face || prod) && !clip.image_url && !(talking && Number(clip.idx) > 0) && !actor;
    const videoSecs = provider.id.startsWith("veo") ? (takesRefs ? 8 : seconds <= 4 ? 4 : seconds <= 6 ? 6 : 8) : seconds;
    // opening frames: Nano Banana 2 (US$0.08, same look and face from the photos) — Pro only as a fallback
    const nb2 = findImage("nano-banana-2");
    const frameModel = nb2?.configured() ? nb2 : nanoBananaPro;
    const estimate = provider.usdPerSecond * videoSecs + (needsFrame ? frameModel.usdPerImage : 0)
      + (talking || actor ? line.length * 0.00022 : ownVoice ? (!story && st.lipsync === "pro" ? lipsyncProUsd(videoSecs, line) : lipsyncUsd(videoSecs, line)) : 0);
    // A free automatic redo uses the voucher the server-side review granted for this clip (if any).
    const freeRedoOf = b?.free === true && before === "done" ? String(ad.id) : undefined;
    await payFor(s.user, estimate, `${story ? "Toma" : "Corte"} ${Number(clip.idx) + 1} · ${provider.label}`, serviceOfModel(provider.id), { ref: id, freeRedoOf });
    charged = true; // paid or free, a failure below gives it back (a free redo gets its voucher back)

    let refs: MediaRef[] = [];
    let image = (clip.image_url as string | null) || "";
    // talking avatar: every cut starts from the same picture as the first one (same room, same light, same
    // clothes), like a real person filming in one place; the edit's zooms and cuts give the rhythm
    if (talking && !image && Number(clip.idx) > 0) {
      for (let t = 0; t < 25 && !image; t++) {
        const first = (await db.list("clips", `ad_id=eq.${ad.id}&idx=eq.0&select=image_url,status`))[0] as { image_url?: string | null; status?: string } | undefined;
        if (first?.image_url) image = String(first.image_url);
        else if (!first || first.status === "failed") break;
        else await new Promise((r) => setTimeout(r, 3000));
      }
    }
    if (TAKES_REFS.has(provider.id) && (face || prod)) {
      refs = [...(face ? [{ url: face, role: "face" as const }] : []), ...(prod ? [{ url: prod, role: "product" as const }] : [])];
    } else if ((face || prod) && !image && !actor) {
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
    if (image && !refs.length && !actor) refs = [{ url: await fetchableUrl(image, ws), role: "first_frame" }];
    if (actor) {
      // the approved take (else record it now), and a piece of the person's video exactly that long, starting
      // at a different moment for each cut so two cuts never open on the same frame
      const approved = st.audios?.[Number(clip.idx)] ?? null;
      const audio = approved ?? (await saveMedia(ws, "audio", (await elevenlabs.speak(ownVoice!, line, { model: "eleven_multilingual_v2", ...(st.voiceSpeed ? { speed: st.voiceSpeed } : {}) })).bytes, "audio/mpeg"));
      const dir = await workdir(`actor-${id}`);
      const vf = path.join(dir, "person.in"), af = path.join(dir, "voice.in"), out = path.join(dir, "part.mp4");
      await Promise.all([download(await fetchableUrl(actorVideo, ws), vf), download(await fetchableUrl(audio, ws), af)]);
      const [vd, ad2] = await Promise.all([probe(vf), probe(af)]);
      if (!vd.dur) throw new Error("No se pudo leer el video de la persona. Súbelo de nuevo en Avatares (MP4 o MOV).");
      const len = Math.min(15.5, Math.max(1.5, (ad2.dur || talkSecs) + 0.3));
      const loop = vd.dur < len + 0.1; // a short video repeats instead of cutting the voice
      await ff(["-y", "-v", "error", ...(loop ? ["-stream_loop", "-1"] : []), "-ss", String(loop ? 0 : actorOffset(Number(clip.idx), vd.dur, len)), "-i", vf, "-t", len.toFixed(2), "-an",
        "-vf", "scale='if(gt(iw,ih),-2,720)':'if(gt(iw,ih),720,-2)',fps=30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], 150_000);
      const part = await saveMedia(ws, "videos", await readFile(out), "video/mp4");
      refs = [{ url: await fetchableUrl(part, ws), role: "video" }, { url: await fetchableUrl(audio, ws), role: "audio" }];
    }
    if (talking) {
      // the recording the customer approved in «Voz»; if there's none (API), record the line now
      const approved = st.audios?.[Number(clip.idx)] ?? null;
      const audio = approved ?? (await saveMedia(ws, "audio", (await elevenlabs.speak(ownVoice!, line, { model: "eleven_multilingual_v2", ...(st.voiceSpeed ? { speed: st.voiceSpeed } : {}) })).bytes, "audio/mpeg"));
      refs.push({ url: await fetchableUrl(audio, ws), role: "audio" });
    }

    // story shots: sound only where a character speaks with the model's voice, or for the scene's
    // ambient sound when the story keeps it (the price is the same: we always charge the audio rate)
    const job = await provider.submit({ prompt: String(clip.prompt), seconds, aspect, resolution: "720p", withAudio: !story || (talks && !ownVoice) || Boolean(story.ambient && !talks), refs });
    const usd = +(provider.usdPerSecond * (provider.id.startsWith("veo") ? (refs.some((r) => r.role !== "first_frame") ? 8 : seconds <= 4 ? 4 : seconds <= 6 ? 6 : 8) : seconds)).toFixed(3);
    // what was paid for travels with the clip: the lip-sync step reads it from here, not from the
    // story (which the customer may edit while the clip renders)
    const extra = story ? { kind: ownVoice ? `shot:ls:${ownVoice}` : "shot", text: talks ? shotPlan!.dialogue!.line : clip.text } : talking ? { kind: "ad:talk" } : actor ? { kind: "ad:actor" } : ownVoice ? { kind: `ad:${st.lipsync === "pro" ? "lsp" : "ls"}:${ownVoice}` } : {};
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
