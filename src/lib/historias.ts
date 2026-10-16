// "Historias animadas": short animated films (30–60 s) told in many short shots with the same
// characters from start to end. Safe for the browser (styles, types, prompt builders); the routes in
// src/app/api/historias do the paid work.
//
// How a story is made:
//  1. Claude writes the plan: title, characters (with a fixed look) and 8–24 shots.
//  2. One reference sheet per character (Nano Banana Pro). The customer approves or replaces it.
//  3. One keyframe per shot, drawn from the character sheets (keeps every face the same).
//  4. Each keyframe is animated by the chosen video model (no sound: music goes on top).
//  5. Music (ElevenLabs) and, optionally, a narrator; the montage cuts every shot to its length.

export type StyleId = "cine3d" | "anime" | "realista" | "plastilina" | "comic" | "acuarela";

export const STYLES: { id: StyleId; name: string; hint: string; prompt: string }[] = [
  {
    id: "cine3d",
    name: "Animación 3D de cine",
    hint: "Como las películas animadas familiares: personajes expresivos, luz cálida.",
    prompt: "high-end 3D animated feature film style, original characters, expressive stylized faces with large eyes, soft subsurface skin, cinematic lighting, rich color grading, shallow depth of field, detailed environments",
  },
  {
    id: "anime",
    name: "Anime",
    hint: "Animación japonesa cinematográfica, colores vivos.",
    prompt: "cinematic Japanese anime film style, clean line art, painterly backgrounds, dramatic lighting, vivid colors, original characters",
  },
  {
    id: "realista",
    name: "Realista de cine",
    hint: "Parece filmado con actores reales y cámara de cine.",
    prompt: "photorealistic cinematic film still, shot on a cinema camera, natural skin texture, anamorphic lens look, film grain, dramatic but natural lighting",
  },
  {
    id: "plastilina",
    name: "Plastilina (stop-motion)",
    hint: "Muñecos de plastilina con texturas hechas a mano.",
    prompt: "claymation stop-motion style, handmade plasticine characters and sets, visible fingerprints and textures, warm miniature lighting",
  },
  {
    id: "comic",
    name: "Cómic animado",
    hint: "Trazos de cómic, sombras marcadas, colores planos.",
    prompt: "animated graphic novel style, bold ink outlines, cel shading, halftone textures, dramatic comic-book lighting, original characters",
  },
  {
    id: "acuarela",
    name: "Acuarela animada",
    hint: "Suave y emotivo, como un libro ilustrado.",
    prompt: "animated watercolor illustration style, soft painted textures, gentle light, storybook feel, original characters",
  },
];
export const styleById = (id: string) => STYLES.find((s) => s.id === id) ?? STYLES[0];

export interface StoryCharacter {
  key: string; // short id used by the shots, e.g. "nino"
  name: string;
  look: string; // fixed visual description in English (age, face, hair, body, clothes)
  image_url?: string | null; // approved reference sheet
  avatar?: string | null; // id of the customer's avatar this character is based on
}

export interface StoryShot {
  idx: number;
  seconds: number; // length in the final film (1.5–5 s)
  shot: string; // camera: "close-up", "wide shot", "over the shoulder"…
  characters: string[]; // keys of who appears
  image: string; // the keyframe: what we see, in English
  motion: string; // what moves during the shot, in English
  narration?: string; // narrator line for this shot (spoken language), optional
  dialogue?: { speaker: string; line: string } | null; // a character speaks on camera (lip-synced)
  es: string; // one line in Spanish so the customer can follow the story
}

/** The shot has a line spoken on camera. */
export const speaks = (s: StoryShot) => Boolean(s.dialogue?.line?.trim() && s.dialogue.speaker);
/** Seconds a spoken line needs (≈ 2.4 words per second, plus a breath). */
export const lineSeconds = (line: string) => Math.ceil((line.trim().split(/\s+/).filter(Boolean).length / 2.4 + 0.8) * 2) / 2;

export interface StoryPlan {
  title: string;
  logline: string; // one sentence, Spanish
  music: string; // music prompt in English
  characters: StoryCharacter[];
  shots: StoryShot[];
}

export interface StorySettings {
  kind: "historia";
  idea: string;
  style: StyleId;
  seconds: number; // target length
  lang: StoryLang;
  narrator: boolean;
  dialogue?: boolean; // characters speak on camera
  voiceId?: string | null;
  plan: StoryPlan;
  music_url?: string | null;
  narration_url?: string | null;
  subtitles?: boolean;
  niche?: string;
}

export const LENGTHS = [30, 45, 60];

export type StoryLang = "es-CL" | "es" | "en";
export const LANGS: { id: StoryLang; name: string; spoken: string }[] = [
  { id: "es-CL", name: "Español de Chile", spoken: "Chilean Spanish as people really talk in Chile: natural Chilean expressions and rhythm (\"po\", \"cachai\", \"al tiro\", \"bacán\" only where they sound natural, never forced), tuteo, no Spain or Mexico slang" },
  { id: "es", name: "Español latino neutro", spoken: "neutral Latin American Spanish, no regional slang" },
  { id: "en", name: "Inglés (EE. UU.)", spoken: "natural US English" },
];
export const langById = (id: string) => LANGS.find((l) => l.id === id) ?? LANGS[0];
/** ElevenLabs language code for the narrator. */
export const voiceLang = (l: StoryLang) => (l === "en" ? "en" : "es");

/** How many shots for a film of this length (the reference films cut every 2–3 s). */
export const shotsFor = (seconds: number) => Math.max(8, Math.min(24, Math.round(seconds / 2.6)));

export function planPrompt(o: { idea: string; style: StyleId; seconds: number; lang: StoryLang; narrator: boolean; dialogue?: boolean; aspect: string }) {
  const st = styleById(o.style);
  const n = shotsFor(o.seconds);
  const spoken = langById(o.lang).spoken;
  return `You are a film director and storyboard artist. Turn this idea into a short animated film for social media (Reels/TikTok, ${o.aspect}).

IDEA (from the customer, may be in Spanish):
"""
${o.idea.slice(0, 3000)}
"""

Visual style: ${st.name} — ${st.prompt}.
Target length: ${o.seconds} seconds, in exactly ${n} shots of 1.5 to 4 seconds each (the seconds must add up to about ${o.seconds}).
${o.narrator ? `There is a narrator. Write short narrator lines in ${spoken}: at most 2.3 words per second of each shot, and leave some shots without narration so the music breathes.` : "There is NO narrator: leave every \"narration\" empty."}
${o.dialogue ? `Characters SPEAK on camera. In about a third to a half of the shots (the key moments), one character says a short line in ${spoken}: "dialogue": {"speaker": "<character key>", "line": "<what they say>"}. One speaker per shot, at most 12 words, and the shot must last at least (words ÷ 2.4 + 1) seconds (up to 5 s). Frame those shots so the speaker's face and mouth are clearly visible. Lines must sound real and emotional, never like an ad. Other shots: "dialogue": null.${o.narrator ? " Never put narration and dialogue in the same shot." : ""}` : "Nobody speaks on camera: every \"dialogue\" is null."}

Rules:
- Strong emotional arc in three acts: a hook in the first 2 seconds, a conflict, a turning point and a satisfying ending. Think viral "based on a true story" shorts.
- Vary the camera: extreme close-ups of faces and eyes for emotion, wide establishing shots, over-the-shoulder, tracking shots from behind, low angles for power, details (hands, objects, screens).
- 1 to 4 main characters, all ORIGINAL (never a famous person, brand mascot or existing character). Give each one a fixed look in English: age, ethnicity, face, hairstyle, body, and the exact clothes they wear in the whole film (only change clothes if the story needs it, and say so in the shot).
- Every shot's "image" is a self-contained description of the first frame in English: setting, time of day, lighting, composition, who is where and their expression. Name characters by their key in square brackets, e.g. [boy], and do NOT re-describe their faces (the reference sheets do that).
- "motion" says in English what moves during the shot (camera move + action), simple enough for 4 seconds of video. No text, captions, logos or watermarks in any image.
- Avoid violence, weapons, real brands and anything unsafe for a general audience.
- "es" is one short line in Spanish describing the shot for the customer.
- Be concise: each "image" at most 55 words, each "motion" at most 20 words, each character "look" at most 50 words. Plain JSON, no comments.
- "music" is a music prompt in English for the soundtrack (genre, mood, tempo, instruments, how it builds), instrumental.
- "title" and "logline" in Spanish${o.lang === "es-CL" ? " from Chile" : ""}.${o.lang === "es-CL" ? "\n- The story happens in Chile unless the idea says otherwise: Chilean places, streets, schools, homes and faces, so a Chilean audience feels it is theirs." : ""}

JSON shape:
{"title":"","logline":"","music":"","characters":[{"key":"boy","name":"","look":""}],"shots":[{"idx":0,"seconds":2.5,"shot":"","characters":["boy"],"image":"","motion":"","narration":"","dialogue":null,"es":""}]}`;
}

/** Cleans what Claude sends back: valid keys, lengths that add up, at most 24 shots. */
export function tidyPlan(p: StoryPlan, seconds: number): StoryPlan {
  const characters = (Array.isArray(p.characters) ? p.characters : [])
    .filter((c) => c && c.key && c.look)
    .slice(0, 4)
    .map((c) => ({ key: String(c.key).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 20) || "c", name: String(c.name || c.key).slice(0, 40), look: String(c.look).slice(0, 600), image_url: null }));
  const keys = new Set(characters.map((c) => c.key));
  let shots = (Array.isArray(p.shots) ? p.shots : []).filter((s) => s && s.image).slice(0, 24).map((s, i) => ({
    idx: i,
    seconds: Math.min(5, Math.max(1.5, Number(s.seconds) || 2.5)),
    shot: String(s.shot ?? "").slice(0, 80),
    characters: (Array.isArray(s.characters) ? s.characters : []).map((k) => String(k).toLowerCase().replace(/[^a-z0-9_-]/g, "")).filter((k) => keys.has(k)).slice(0, 3),
    image: String(s.image).slice(0, 1200),
    motion: String(s.motion ?? "").slice(0, 500),
    narration: String(s.narration ?? "").slice(0, 300),
    dialogue: s.dialogue && keys.has(String(s.dialogue.speaker ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "")) && String(s.dialogue.line ?? "").trim()
      ? { speaker: String(s.dialogue.speaker).toLowerCase().replace(/[^a-z0-9_-]/g, ""), line: String(s.dialogue.line).trim().slice(0, 160) }
      : null,
    es: String(s.es ?? "").slice(0, 200),
  }));
  // scale the lengths so the film lasts what the customer asked for
  const total = shots.reduce((a, s) => a + s.seconds, 0);
  if (total > 0) {
    const k = seconds / total;
    shots = shots.map((s) => ({ ...s, seconds: Math.round(Math.min(5, Math.max(1.5, s.seconds * k)) * 10) / 10 }));
  }
  // a spoken line needs its time (up to 8 s; the film gets a bit longer rather than cutting words)
  shots = shots.map((s) => (s.dialogue ? { ...s, seconds: Math.min(8, Math.max(s.seconds, lineSeconds(s.dialogue.line))) } : s));
  return { title: String(p.title ?? "Historia").slice(0, 80), logline: String(p.logline ?? "").slice(0, 300), music: String(p.music ?? "").slice(0, 600), characters, shots };
}

export function characterPrompt(c: StoryCharacter, style: StyleId) {
  const st = styleById(style);
  return `Character reference sheet for an animated film. Style: ${st.prompt}.
Character "${c.name}": ${c.look}
Show the SAME character three times side by side on a plain light grey background: full body front view, three-quarter view, and a large close-up portrait of the face with a neutral expression. Consistent proportions, clothes and colors in all three. No text, no labels, no watermark.`;
}

/** A character sheet that turns one of the customer's avatars (a real photo) into the film's style. */
export function avatarCharacterPrompt(c: StoryCharacter, style: StyleId) {
  return `${characterPrompt(c, style)}
IMPORTANT: this character is the person in the reference photo. Keep their likeness (face shape, skin tone, eyes, nose, hairline, age) clearly recognizable, translated into the film's style. Clothes and hair as described above unless the description says to keep them from the photo.`;
}

export function keyframePrompt(shot: StoryShot, plan: StoryPlan, style: StyleId, aspect: string) {
  const st = styleById(style);
  const who = shot.characters
    .map((k, i) => {
      const c = plan.characters.find((x) => x.key === k);
      return c ? `[${k}] is ${c.name}: the character in reference image ${i + 1} (same face, hair, body and clothes). ${c.look}` : "";
    })
    .filter(Boolean)
    .join("\n");
  return `A single frame from an animated film, ${aspect} vertical composition. Style: ${st.prompt}.
Shot: ${shot.shot}.
${shot.image}
${who ? `Characters:\n${who}` : ""}
Keep every character exactly as in their reference sheet. Cinematic, emotional, high detail. No text, no captions, no logos, no watermark, no split panels.`;
}

export function motionPrompt(shot: StoryShot, style: StyleId, plan?: StoryPlan, lang: StoryLang = "es-CL") {
  const st = styleById(style);
  const base = `${shot.motion || "Subtle natural movement, slow cinematic camera push-in."} Keep the style (${st.name}: ${st.prompt}) and the characters exactly as in the first frame. Smooth, cinematic motion. No text or captions.`;
  if (shot.dialogue && speaks(shot)) {
    const who = plan?.characters.find((c) => c.key === shot.dialogue!.speaker);
    const name = who ? `${who.name} (${who.look.split(/[.,]/)[0]})` : shot.dialogue.speaker;
    return `${base}
${name} looks natural and speaks this line out loud, with clear lip sync and a voice that fits their age and gender, in ${langById(lang).spoken}: "${shot.dialogue.line}"
Only ${who?.name ?? "this character"} speaks; everyone else stays silent. No background music, no other voices.`.slice(0, 2400);
  }
  return `${base} No dialogue, no lip movement.`.slice(0, 2400);
}

/** Rough provider cost of a whole film, to show before starting. */
export function estimateStory(o: { characters: number; shots: number; videoSecondsPerShot: number; usdPerSecond: number; usdPerImage: number; seconds: number }) {
  const images = (o.characters + o.shots) * o.usdPerImage;
  const video = o.shots * o.videoSecondsPerShot * o.usdPerSecond;
  const music = (0.15 * Math.max(o.seconds, 15)) / 60;
  return { images: +images.toFixed(2), video: +video.toFixed(2), music: +music.toFixed(2), total: +(images + video + music).toFixed(2) };
}
