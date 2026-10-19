import { createHash } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { claude, parseJSON } from "../providers/claude";
import { cropImage, download, probe, sceneCuts, still, workdir } from "../montage";
import { fetchableUrl, ownsMedia, saveMedia } from "../media";
import { readPrivateJSON, writePrivateJSON } from "../supabase";
import { sharedRules, type Db } from "../db";
import { learnFrom } from "../learn";

// «Mi personaje en un video», done carefully (what Higgsfield's Recast and Kling's own guide ask for):
//  1. Before charging: the video is checked (one shot, one clear main person with the upper body visible,
//     nothing big in the hands, moderate motion). Red stops it; yellow warns with a tip.
//  2. Identity lock: the character's face is cut out of its sheet once and sent to Kling as @Element1.
//  3. After each step a review: the scene picture (one character, the right face, no new objects) and the
//     final video (no double, same face, no melting objects). A severe problem is redone once, free.
//  4. Every problem found becomes a learned rule (owner approves it in Aprendizajes) for the next videos.

export type Level = "verde" | "amarillo" | "rojo";
export interface Check { level: Level; text: string }
export interface Analysis {
  level: Level;
  checks: Check[];
  /** Where the usable part starts and how long it lasts (s). */
  start: number;
  usable: number;
  dur: number;
  /** Who the main person is (for the prompts). */
  main?: string;
  v: 1;
}

const VERSION = 1;
const cacheFile = (ref: string) => `analisis/${createHash("sha256").update(ref).digest("hex").slice(0, 32)}.json`;
const MIN = 3;

interface Seen {
  first_clear: number;
  people: "one" | "main_clear" | "similar";
  hands: "none" | "small" | "big";
  hands_what?: string;
  fast: boolean;
  face_hidden: boolean;
  main?: string;
}

async function look(frames: string[]): Promise<Seen | null> {
  if (!claude.configured()) return null;
  try {
    return parseJSON<Seen>(await claude.complete({
      fast: true, json: true, maxTokens: 1200, images: frames,
      prompt: `These are ${frames.length} frames of one phone video, in order (frame 0 to ${frames.length - 1}), about one second apart. A character will replace the MAIN person of this video (the one the video is about, usually the biggest / the one the camera follows) and copy their movements.
Answer about that main person:
- first_clear: the number of the EARLIEST frame where the main person's COMPLETE upper body is clearly visible: head, both shoulders, both arms and the torso down to the waist, all inside the picture, not inside a car, not behind a door or object, not cut by the edge. Being only partly out of a car does NOT count. -1 if no frame shows it.
- people: "one" if only the main person appears; "main_clear" if there are others but the main person is clearly the biggest in the picture; "similar" if another person is about as big as the main person.
- hands: what the main person holds: "none", "small" (a cup, a phone, a pen) or "big" (a bag, a box, a tray, another big object). hands_what: what it is, in Spanish, two or three words.
- fast: true if the main person moves very fast (running, jumping, spinning, dancing fast).
- face_hidden: true if the main person's face is hidden or turned away most of the time.
- main: who the main person is, in English, under 15 words (e.g. "bald man in a black tracksuit getting out of a pink car").
JSON: {"first_clear": number, "people": "", "hands": "", "hands_what": "", "fast": false, "face_hidden": false, "main": ""}`,
    }));
  } catch { return null; }
}

/** Plain-Spanish checks from what was seen. Exported for tests. */
export function judge(dur: number, times: number[], seen: Seen | null, cuts: number[]): Analysis {
  const checks: Check[] = [];
  if (!seen) {
    checks.push({ level: "amarillo", text: "No pudimos revisar el video en detalle. Funciona mejor con una sola persona, de frente, de la cintura para arriba y sin nada en las manos." });
    const end = cuts.find((c) => c > 0.3) ?? dur;
    return { level: end < MIN ? "rojo" : "amarillo", checks: end < MIN ? [{ level: "rojo", text: "El video cambia de toma antes de los 3 segundos." }] : checks, start: 0, usable: +end.toFixed(2), dur, v: VERSION };
  }
  if (seen.first_clear < 0 || seen.first_clear >= times.length) {
    checks.push({ level: "rojo", text: "La persona principal nunca se ve completa de la cintura para arriba (por ejemplo, está dentro de un auto o tapada). Usa un video donde se le vea de frente, con cabeza, hombros, brazos y torso." });
    return { level: "rojo", checks, start: 0, usable: 0, dur, main: seen.main, v: VERSION };
  }
  const start = times[seen.first_clear];
  const cutAfter = cuts.find((c) => c > start + 0.3);
  const end = cutAfter ?? dur;
  const usable = +(end - start).toFixed(2);
  if (usable < MIN) checks.push({ level: "rojo", text: `Después del momento en que se ve bien a la persona quedan menos de 3 segundos de una misma toma. Usa un video más largo o sin cambios de toma.` });
  else {
    checks.push({ level: "verde", text: start > 0 ? `Se ve bien a la persona desde el segundo ${start.toLocaleString("es-CL")}: el video empieza ahí.` : "La persona principal se ve bien desde el comienzo." });
    if (cutAfter !== undefined) checks.push({ level: "amarillo", text: `El video cambia de toma en el segundo ${cutAfter.toFixed(1).replace(".", ",")}: usamos solo la primera toma (${usable.toFixed(1).replace(".", ",")} s).` });
  }
  if (seen.people === "similar") checks.push({ level: "amarillo", text: "Hay otra persona casi del mismo tamaño que la principal: el modelo puede confundirse o duplicar al personaje. Mejor un video con una sola persona protagonista." });
  else if (seen.people === "main_clear") checks.push({ level: "verde", text: "Hay más gente, pero la persona principal se distingue bien (las demás quedan como están)." });
  if (seen.hands === "big") checks.push({ level: "amarillo", text: `Tiene ${seen.hands_what || "un objeto grande"} en las manos: los objetos grandes a veces se duplican o se deforman.` });
  else if (seen.hands === "small") checks.push({ level: "verde", text: `Lleva ${seen.hands_what || "algo chico"} en la mano: suele salir bien.` });
  if (seen.fast) checks.push({ level: "amarillo", text: "Se mueve muy rápido: con movimientos rápidos el resultado puede salir más corto o con errores." });
  if (seen.face_hidden) checks.push({ level: "amarillo", text: "Casi no se le ve la cara: el personaje puede perder parecido." });
  const level: Level = checks.some((c) => c.level === "rojo") ? "rojo" : checks.some((c) => c.level === "amarillo") ? "amarillo" : "verde";
  return { level, checks, start, usable: usable < MIN ? 0 : usable, dur, main: seen.main, v: VERSION };
}

/** The candidate moments: 0, 0.5 s, then one per second, while 3 s still remain. */
export const candidateTimes = (dur: number) => [0, 0.5, ...Array.from({ length: 14 }, (_, i) => i + 1)].filter((t) => t === 0 || t <= dur - MIN - 0.2);

/** Checks a customer's video (cached per video, so the check and the start agree and it's paid once). */
export async function analyzeVideo(ref: string, ws: string): Promise<Analysis> {
  const cached = await readPrivateJSON<Analysis>(cacheFile(ref)).catch(() => null);
  if (cached?.v === VERSION) return cached;
  const dir = await workdir(`chk-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`);
  try {
    const src = `${dir}/v.mp4`;
    await download(await fetchableUrl(ref, ws), src);
    const dur = (await probe(src)).dur;
    const times = candidateTimes(dur);
    const [cuts, frames] = await Promise.all([
      sceneCuts(src).catch(() => [] as number[]),
      Promise.all(times.map(async (t, i) => { const f = `${dir}/f${i}.jpg`; await still(src, t, f, 360); return `data:image/jpeg;base64,${(await readFile(f)).toString("base64")}`; })),
    ]);
    const a = judge(dur, times, await look(frames), cuts);
    await writePrivateJSON(cacheFile(ref), a).catch(() => {});
    return a;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => null);
  }
}

// ---------------------------------------------------------------- the face kit (identity lock)

export interface FaceKit { front: string; refs: string[] }
interface Boxes { face?: Box; body?: Box }
interface Box { x: number; y: number; w: number; h: number }
const okBox = (b?: Box): b is Box => Boolean(b) && [b!.x, b!.y, b!.w, b!.h].every((n) => typeof n === "number" && n >= 0 && n <= 1) && b!.w > 0.04 && b!.h > 0.08;

/** Cuts the face close-up and the front full body out of a character sheet (media refs of the workspace). */
export async function cutFaceKit(sheetRef: string, ws: string): Promise<FaceKit | null> {
  if (!claude.configured() || !ownsMedia(sheetRef, ws)) return null;
  const dir = await workdir(`face-${Date.now().toString(36)}`);
  try {
    const src = `${dir}/sheet.png`;
    const url = await fetchableUrl(sheetRef, ws);
    await download(url, src);
    const preview = `${dir}/small.jpg`;
    await still(src, 0, preview, 512);
    const b = parseJSON<Boxes>(await claude.complete({
      fast: true, json: true, maxTokens: 600, images: [`data:image/jpeg;base64,${(await readFile(preview)).toString("base64")}`],
      prompt: `This is a character reference sheet (the same character in several views). Give two boxes as fractions of the picture (0 to 1, x and y from the top-left corner):
- face: the LARGEST front-facing view of the face (usually a big close-up portrait): the whole head with hair, from the top of the hair to the chin, and the ears.
- body: the FRONT full-body view (facing the camera), from the top of the head to the feet.
JSON: {"face": {"x":0,"y":0,"w":0,"h":0}, "body": {"x":0,"y":0,"w":0,"h":0}}`,
    }));
    if (!okBox(b.face)) return null;
    await cropImage(src, b.face, `${dir}/face.jpg`, 0.08);
    const front = await saveMedia(ws, "personajes", await readFile(`${dir}/face.jpg`), "image/jpeg");
    const refs: string[] = [];
    if (okBox(b.body)) {
      try { await cropImage(src, b.body, `${dir}/body.jpg`, 0.05); refs.push(await saveMedia(ws, "personajes", await readFile(`${dir}/body.jpg`), "image/jpeg")); } catch { /* the face alone is enough */ }
    }
    return { front, refs };
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => null);
  }
}

interface AvatarRow { id: string; image_url: string | null; notes: string | null }

/**
 * The face kit of a saved character (made once and kept with it). Null for a plain photo (not a saved
 * character) or when it can't be made: the video is still made, only without the identity lock.
 */
export async function faceKitFor(db: Db, image: string, ws: string): Promise<FaceKit | null> {
  const rows = (await db.list("avatars", `image_url=eq.${encodeURIComponent(image)}&limit=5`).catch(() => [])) as unknown as AvatarRow[];
  const row = rows.find((r) => { try { return JSON.parse(r.notes ?? "{}").kind === "personaje"; } catch { return false; } });
  if (!row) return null;
  const notes = JSON.parse(row.notes ?? "{}") as { face?: FaceKit | null; faceTried?: string };
  if (notes.face?.front) return notes.face;
  if (notes.faceTried && Date.now() - Date.parse(notes.faceTried) < 6 * 3600_000) return null; // failed recently: don't retry every time
  const face = await cutFaceKit(image, ws);
  await db.update("avatars", row.id, { notes: JSON.stringify({ ...notes, ...(face ? { face } : { faceTried: new Date().toISOString() }) }) }).catch(() => null);
  return face;
}

// ---------------------------------------------------------------- learned rules and prompts

/** Active learned rules for character videos (approved by the owner in Aprendizajes). */
export async function swapRules(): Promise<string[]> {
  const got = await sharedRules.list("active=eq.true&order=hits.desc&limit=60").catch(() => []);
  const rows = (Array.isArray(got) ? got : []) as { rule_en: string; formats: string[] | null }[];
  return rows.filter((r) => (r.formats ?? []).includes("personaje")).slice(0, 8).map((r) => r.rule_en);
}

export function framePrompt(o: { extra?: string; main?: string; withFace?: boolean; fix?: string[]; rules?: string[] }) {
  return [
    "Image 1 is a frame from a real phone video. Image 2 is a reference sheet of ONE single fictional character seen from several angles (front, side, back and a face close-up): it is one person, not several.",
    o.withFace ? "Image 3 is a close-up of that same character's face: the face must match it exactly." : "",
    `Edit image 1: replace ONLY the main person${o.main ? ` (${o.main})` : " (the most prominent person, the one the video is about)"} with this character: exactly the same face, nose, hair, glasses, facial hair, body type and clothes as in image 2.`,
    "Keep that person's exact pose, position, size in the frame and whatever they hold in their hands. Their head, shoulders, arms and torso must be fully visible.",
    "Everything else stays identical to image 1: the place, the background, the light, the camera angle and every other person.",
    "There must be only ONE of this character in the picture. Do not add any object that is not in image 1. Photorealistic, same photo quality and grain as image 1, no text.",
    ...(o.rules ?? []),
    o.fix?.length ? `The previous attempt had these problems, avoid them: ${o.fix.join("; ")}.` : "",
    o.extra ? `Also: ${o.extra}` : "",
  ].filter(Boolean).join("\n");
}

export function motionPrompt(o: { extra?: string; withFace?: boolean; fix?: string[]; rules?: string[] }) {
  return [
    o.withFace ? "@Element1 is the character: keep exactly the same face in every frame." : "",
    "Only one person is the character; there is never a second copy of him. Hands and held objects stay natural and solid; nothing appears, duplicates or falls.",
    ...(o.rules ?? []),
    o.fix?.length ? `Avoid: ${o.fix.join("; ")}.` : "",
    o.extra ?? "",
  ].filter(Boolean).join(" ").slice(0, 2400);
}

// ---------------------------------------------------------------- reviews

export interface Review { severe: boolean; issues: string[] }
const NO_REVIEW: Review = { severe: false, issues: [] };

/** The scene picture against the original frame and the character. */
export async function reviewFrame(original: string, result: string, sheet: string): Promise<Review> {
  if (!claude.configured()) return NO_REVIEW;
  try {
    const r = parseJSON<{ severe?: boolean; issues?: string[] }>(await claude.complete({
      json: true, maxTokens: 1200, images: [original, result, sheet],
      prompt: `Quality check of an AI edit. Image 1: the original frame. Image 2: the edited frame, where the main person should be replaced by the character of image 3 (a reference sheet of ONE character in several views).
Severe problems (any one makes it severe):
- the character appears more than once, or the wrong person was replaced, or another person also became the character;
- the face, glasses, hair or clothes clearly don't match the character of image 3;
- an object that is not in image 1 was added, or an object is duplicated or deformed;
- the character's head, shoulders, arms or torso are cut off or hidden;
- deformed body, extra limbs or fingers, melted face.
Ignore small differences in light or background details.
JSON: {"severe": boolean, "issues": ["each problem in plain English, short"]}`,
    }));
    return { severe: Boolean(r.severe), issues: (r.issues ?? []).filter((x) => typeof x === "string").slice(0, 6) };
  } catch { return NO_REVIEW; }
}

/** The final video: six moments against the character. */
export async function reviewVideo(videoUrl: string, sheet: string): Promise<Review> {
  if (!claude.configured()) return NO_REVIEW;
  const dir = await workdir(`qa-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`);
  try {
    const f = `${dir}/out.mp4`;
    await download(videoUrl, f);
    const dur = (await probe(f)).dur;
    if (!dur) return NO_REVIEW;
    const frames = await Promise.all([0.05, 0.22, 0.4, 0.58, 0.76, 0.94].map(async (p, i) => { const o = `${dir}/q${i}.jpg`; await still(f, p * dur, o, 480); return `data:image/jpeg;base64,${(await readFile(o)).toString("base64")}`; }));
    const r = parseJSON<{ severe?: boolean; issues?: string[] }>(await claude.complete({
      json: true, maxTokens: 1200, images: [...frames, sheet],
      prompt: `Quality check of an AI video. The first 6 images are moments of the video, in order. The last image is the reference sheet of the character (ONE character in several views) who should be the main person of the video.
Severe problems (any one makes it severe):
- the character appears twice or more at the same time, or a second copy appears;
- the main person's face clearly changes into a different person, or stops looking like the character;
- held objects duplicate, melt, fall or pop in and out; extra limbs, broken arms or hands, melted face;
- the character disappears or the video freezes.
Ignore small changes of light, background people and slight blur.
JSON: {"severe": boolean, "issues": ["each problem in plain English, short"]}`,
    }));
    return { severe: Boolean(r.severe), issues: (r.issues ?? []).filter((x) => typeof x === "string").slice(0, 6) };
  } catch { return NO_REVIEW; } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => null);
  }
}

/** Problems become rules for every future character video (waiting for the owner's approval). */
export const learnSwap = (issues: string[]) => (issues.length ? learnFrom(issues, "personaje (un personaje reemplaza a la persona de un video y copia sus movimientos)", false, ["personaje"]).catch(() => 0) : Promise.resolve(0));

/** Genjutsu: what to recast (reference image 1 = the whole character, image 2 = its face, when there's a kit). */
export function genjutsuPrompt(o: { extra?: string; main?: string; withFace?: boolean; fix?: string[]; rules?: string[] }) {
  return [
    `Recast the main person of the video${o.main ? ` (${o.main})` : ""} as the character in the reference images${o.withFace ? " (image 1 shows the whole character, image 2 is a close-up of the same character's face)" : ""}: the same face, hair, glasses, facial hair, body and clothes.`,
    "The references show ONE single character: there is only one of him in the video.",
    "Keep everything else exactly as in the source video: camera, motion, timing, background, light, the other people and every object (held objects stay the same objects).",
    ...(o.rules ?? []),
    o.fix?.length ? `Avoid: ${o.fix.join("; ")}.` : "",
    o.extra ?? "",
  ].filter(Boolean).join(" ").slice(0, 2000);
}
