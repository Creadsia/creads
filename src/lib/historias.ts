// "Historias animadas": short animated films (30–60 s) told in many short shots with the same
// characters from start to end. Safe for the browser (styles, types, prompt builders); the routes in
// src/app/api/historias do the paid work.
//
// How a story is made:
//  1. Claude writes the plan: title, characters (with a fixed look) and 8–24 shots.
//  2. One reference sheet per character (Nano Banana Pro). The customer approves or replaces it.
//  3. One keyframe per shot, drawn from the character sheets (keeps every face the same).
//  4. Each keyframe is animated by the chosen video model (no sound: music goes on top).
//  5. Sound, all optional and combinable: characters speaking on camera with their lips in sync, a
//     narrator, the scene's ambient sound, and music: made by AI (instrumental), a song with lyrics,
//     the customer's own track, or none. The montage cuts every shot to its length and mixes it all.

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
  voiceId?: string | null; // the character speaks with this voice (e.g. the avatar's cloned voice)
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

/** A spoken line of at most 14 words (longer ones don't fit a shot or a lip-sync). */
export const shortLine = (line: string) => line.trim().split(/\s+/).filter(Boolean).slice(0, 14).join(" ").slice(0, 160);

/** The shot has a line spoken on camera. */
export const speaks = (s: StoryShot) => Boolean(s.dialogue?.line?.trim() && s.dialogue.speaker);
/** Seconds of video generated for a story shot (the montage cuts it to the plan's length). */
export function storyClipSeconds(shot: StoryShot | undefined, ownVoice: boolean) {
  const secs = Number(shot?.seconds);
  const s = Number.isFinite(secs) && secs > 0 ? Math.min(8, secs) : 2.5;
  if (ownVoice && shot?.dialogue?.line) return lipsyncSeconds(shot.dialogue.line);
  return Math.min(10, Math.max(4, Math.ceil(s + (shot && speaks(shot) ? 1 : 0.6))));
}

/** What a video model really makes for a requested length: its nearest allowed duration at or above it. */
export function billedSeconds(seconds: number, durations?: number[], veo = false) {
  if (veo) return seconds <= 4 ? 4 : seconds <= 6 ? 6 : 8;
  if (!durations?.length) return seconds;
  const up = [...durations].sort((a, b) => a - b).find((d) => d >= seconds);
  return up ?? Math.max(...durations);
}

/** Price of animating one story shot (and recording + lip-syncing its line with the character's voice). */
export function storyShotUsd(shot: StoryShot | undefined, model: { id: string; usdPerSecond: number; durations?: number[] | null }, ownVoice: boolean) {
  const secs = billedSeconds(storyClipSeconds(shot, ownVoice), model.durations ?? undefined, model.id.startsWith("veo"));
  return model.usdPerSecond * secs + (ownVoice && shot?.dialogue?.line ? lipsyncUsd(secs, shot.dialogue.line) : 0);
}

/** Recording the line with the character's voice (ElevenLabs) + lip-syncing it (Kling Lipsync). */
export const lipsyncUsd = (seconds: number, line: string) => +(0.014 * Math.max(5, Math.ceil(seconds / 5) * 5) + line.length * 0.00022).toFixed(3);
/** «Boca natural»: sync.so sync-3 on fal (US$8 per minute of video) plus the recorded line. */
export const lipsyncProUsd = (seconds: number, line: string) => +((8 / 60) * Math.max(1, seconds) + line.length * 0.00022).toFixed(3);
/** Seconds of video a lip-synced line needs (the recorded line must fit inside the clip). */
export const lipsyncSeconds = (line: string) => Math.min(10, Math.max(4, Math.ceil(line.trim().split(/\s+/).filter(Boolean).length / 2.2 + 1.5)));
/** Seconds a spoken line needs (≈ 2.4 words per second, plus a breath). */
export const lineSeconds = (line: string) => Math.ceil((line.trim().split(/\s+/).filter(Boolean).length / 2.4 + 0.8) * 2) / 2;

export interface StoryPlan {
  title: string;
  logline: string; // one sentence, Spanish
  music: string; // music prompt in English
  lyrics?: string; // song lyrics (when the soundtrack is a song), in the story's language
  characters: StoryCharacter[];
  shots: StoryShot[];
}

/** The soundtrack: AI instrumental music, an AI song with lyrics, the customer's own track, or none. */
export type MusicMode = "ia" | "cancion" | "propia" | "ninguna";
export const MUSIC_MODES: { id: MusicMode; name: string; hint: string }[] = [
  { id: "ia", name: "Música IA", hint: "Instrumental, hecha a la medida de la película." },
  { id: "cancion", name: "Canción con letra", hint: "Una canción cantada sobre tu historia." },
  { id: "propia", name: "Mi música", hint: "Sube tu canción o audio (mp3, m4a, wav)." },
  { id: "ninguna", name: "Sin música", hint: "Solo voces y sonido ambiente." },
];
export const musicModeOf = (st: { music_mode?: string } | null | undefined): MusicMode =>
  (["ia", "cancion", "propia", "ninguna"].includes(String(st?.music_mode)) ? (st!.music_mode as MusicMode) : "ia");

/** A soundtrack made by AI, kept so switching options back and forth doesn't pay again. */
export interface SavedTrack { url: string; secs: number; lyrics?: string; prompt?: string }

/** The saved AI track of this kind (stories from before keep their instrumental in music_url). */
export function savedTrack(st: { music_by?: { ia?: SavedTrack; cancion?: SavedTrack }; music_url?: string | null; music_secs?: number; music_made?: string }, kind: "ia" | "cancion"): SavedTrack | null {
  const t = st.music_by?.[kind];
  if (t?.url) return t;
  if (st.music_url && (st.music_made ?? "ia") === kind) return { url: st.music_url, secs: st.music_secs ?? 0 };
  return null;
}

/**
 * Whether building the film must make (and charge) a new AI track: none of this kind yet, the customer
 * asked for another one, the film got longer, or (a song) its lyrics changed since it was made.
 */
export function needsNewTrack(st: Parameters<typeof savedTrack>[0], kind: "ia" | "cancion", seconds: number, lyrics: string, again = false) {
  const t = savedTrack(st, kind);
  return !t || again || t.secs < seconds - 0.5 || (kind === "cancion" && (t.lyrics ?? "").trim() !== lyrics.trim());
}

/** One-tap sound setups (everything stays editable). */
export interface SoundSetup { dialogue: boolean; narrator: boolean; music: MusicMode; ambient: boolean }
export const SOUND_PRESETS: ({ id: string; name: string; hint: string } & SoundSetup)[] = [
  { id: "pelicula", name: "Película con diálogos", hint: "Los personajes hablan con los labios sincronizados, con música suave de fondo.", dialogue: true, narrator: false, music: "ia", ambient: true },
  { id: "dialogos", name: "Solo diálogos, sin música", hint: "Hablan con los labios sincronizados y se escucha el ambiente, como una escena real.", dialogue: true, narrator: false, music: "ninguna", ambient: true },
  { id: "narrador", name: "Narrador + música", hint: "Una voz en off cuenta la historia sobre la música.", dialogue: false, narrator: true, music: "ia", ambient: false },
  { id: "viral", name: "Solo música", hint: "Sin voces: imágenes y música, como los videos virales.", dialogue: false, narrator: false, music: "ia", ambient: false },
  { id: "cancion", name: "Videoclip con canción", hint: "Una canción con letra que cuenta tu historia.", dialogue: false, narrator: false, music: "cancion", ambient: false },
  { id: "silencio", name: "Sin música ni voces", hint: "Solo el sonido ambiente de cada escena.", dialogue: false, narrator: false, music: "ninguna", ambient: true },
];
export const presetOf = (s: SoundSetup) => SOUND_PRESETS.find((p) => p.dialogue === s.dialogue && p.narrator === s.narrator && p.music === s.music && p.ambient === s.ambient)?.id ?? null;

/** Ideas to start from: they fill the idea, how the characters talk and the sound that fits. */
export const STORY_TEMPLATES: { id: string; name: string; idea: string; context: string; preset: string; style: StyleId }[] = [
  {
    id: "mentor", name: "Mentor y alumno", style: "anime", preset: "pelicula",
    idea: "Tomás tiene 12 años, vive en un barrio de Santiago y siente que en el colegio le enseñan cosas que no le sirven. Una tarde conoce a Pancho, un emprendedor de unos 30 años, tranquilo y seguro, que tiene un carro de café en la plaza. Pancho le enseña lo que el colegio no enseña: cómo elegir qué vender, cómo hablarle a un cliente y cómo ahorrar. Tomás arma su puesto de limonadas, se equivoca, aprende y vuelve a intentarlo. En la feria de fin de año presenta su emprendimiento frente a todos y le agradece a Pancho, que lo mira orgulloso desde el público.",
    context: "Pancho habla relajado y seguro, como mentor, con frases cortas. Tomás habla como un niño de 12 años, curioso y tímido al principio. Frases que no pueden faltar: «El colegio te enseña a sumar; la calle te enseña a ganar» y «Gracias, Pancho, por creer en mí antes que yo».",
  },
  {
    id: "superacion", name: "Historia de superación", style: "cine3d", preset: "narrador",
    idea: "Una mujer de 40 años pierde su trabajo y empieza a vender empanadas desde su cocina. Los primeros días nadie compra y piensa en rendirse. Su hija le arma una página y le saca fotos a sus empanadas. De a poco llegan los pedidos, abre su primer local y el día de la inauguración su hija le dice que es su heroína.",
    context: "Tono emotivo y esperanzador. Un final que dé ganas de llorar de alegría.",
  },
  {
    id: "cliente", name: "Antes y después de un cliente", style: "realista", preset: "dialogos",
    idea: "Don Jorge tiene 65 años y su casa tiene grietas en las paredes que empeoran cada invierno. Su vecino le recomienda una empresa de reparación de cimientos. Llegan, revisan sin cobrar y en una semana la casa queda firme. Don Jorge invita a su familia a almorzar y les muestra las paredes sin grietas, orgulloso.",
    context: "Don Jorge habla con calma y cariño. Que se note el alivio. Sin sonar a comercial.",
  },
  {
    id: "negocio", name: "Un día en mi negocio", style: "cine3d", preset: "viral",
    idea: "Un día completo en una pastelería de barrio: a las 5 de la mañana se encienden los hornos, el equipo amasa entre risas, los primeros clientes hacen fila, un niño elige su torta de cumpleaños y al cierre la dueña apaga la luz mirando su vitrina vacía, feliz.",
    context: "Ritmo rápido, mucho detalle de manos, harina y vapor.",
  },
  {
    id: "comercial", name: "Mini comercial divertido", style: "plastilina", preset: "pelicula",
    idea: "Rocco, un perro, está aburrido porque su dueño trabaja todo el día en el computador haciendo anuncios. Rocco descubre una app que hace los anuncios sola, la abre con la pata, el anuncio queda listo en minutos y por fin salen juntos al parque.",
    context: "Humor tierno. El dueño le habla con cariño a Rocco. Rocco no habla, solo reacciona.",
  },
  {
    id: "videoclip", name: "Videoclip de marca", style: "acuarela", preset: "cancion",
    idea: "Una joven recorre su ciudad al amanecer en bicicleta y en cada esquina aparece algo que la inspira: un mural, un músico callejero, una abuela regando flores. Al final llega a su pequeño taller de cerámica y abre la puerta con una sonrisa.",
    context: "Que la canción hable de empezar de nuevo cada día.",
  },
];

export interface StorySettings {
  kind: "historia";
  idea: string;
  context?: string; // how the characters talk, lines that can't be missing
  music_mode?: MusicMode; // undefined = "ia" (stories made before the option existed)
  ambient?: boolean; // keep each shot's natural sound (street, wind, kitchen…)
  mute_dialogue?: boolean; // the film plays without the characters' voices
  style: StyleId;
  seconds: number; // target length
  lang: StoryLang;
  narrator: boolean;
  dialogue?: boolean; // characters speak on camera
  voiceId?: string | null;
  plan: StoryPlan;
  music_url?: string | null; // (stories made before music_by) the AI instrumental
  music_secs?: number; // how long that music is
  music_made?: "ia" | "cancion"; // (short-lived) what music_url held
  music_by?: { ia?: SavedTrack; cancion?: SavedTrack }; // one saved track per kind, reused while valid
  own_music_url?: string | null; // the customer's own track (music_mode "propia")
  narration_url?: string | null;
  narration_cache?: Record<string, string>; // "<voice>|<line>" → recorded file
  duration?: number;
  subtitles?: boolean;
  niche?: string;
}

export const LENGTHS = [30, 45, 60];

export type StoryLang = "es-CL" | "es-CL-calle" | "es" | "en";
export const LANGS: { id: StoryLang; name: string; spoken: string }[] = [
  { id: "es-CL", name: "Chileno, bien hablado", spoken: "Chilean Spanish spoken well and naturally: Chilean rhythm, vocabulary and tuteo, warm and clear, but NO slang or fillers at all (never \"po\", \"cachai\", \"weón\", \"al tiro\", \"bacán\", \"fome\" or similar), no Spain or Mexico expressions" },
  { id: "es-CL-calle", name: "Chileno con modismos", spoken: "Chilean Spanish as people really talk on the street: natural Chilean expressions and rhythm (\"po\", \"cachai\", \"al tiro\", \"bacán\" only where they sound natural, never forced), tuteo, no Spain or Mexico slang" },
  { id: "es", name: "Español latino neutro", spoken: "neutral Latin American Spanish, no regional slang" },
  { id: "en", name: "Inglés (EE. UU.)", spoken: "natural US English" },
];
export const langById = (id: string) => LANGS.find((l) => l.id === id) ?? LANGS[0];
/** The story happens in Chile and is told in Chilean Spanish (with or without slang). */
export const isChile = (l: string) => l === "es-CL" || l === "es-CL-calle";
/** ElevenLabs language code for the narrator. */
export const voiceLang = (l: StoryLang) => (l === "en" ? "en" : "es");

/** How many shots for a film of this length (the reference films cut every 2–3 s). */
export const shotsFor = (seconds: number) => Math.max(8, Math.min(24, Math.round(seconds / 2.6)));

export function planPrompt(o: { idea: string; style: StyleId; seconds: number; lang: StoryLang; narrator: boolean; dialogue?: boolean; aspect: string; context?: string; music?: MusicMode }) {
  const st = styleById(o.style);
  const n = shotsFor(o.seconds);
  const spoken = langById(o.lang).spoken;
  return `You are a film director and storyboard artist. Turn this idea into a short animated film for social media (Reels/TikTok, ${o.aspect}).

IDEA (from the customer, may be in Spanish):
"""
${o.idea.slice(0, 3000)}
"""
${o.context?.trim() ? `How the characters talk, and lines that can't be missing (follow this exactly):\n"""\n${o.context.slice(0, 1500)}\n"""\n` : ""}
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
- Avoid violence, weapons, real brands and anything unsafe for a general audience. If a child is in the story, an adult who is not family is never alone with them in private or in a vehicle: they meet in public places, at school or with a parent present (image models refuse those scenes).
- "es" is one short line in Spanish describing the shot for the customer.
- Be concise: each "image" at most 55 words, each "motion" at most 20 words, each character "look" at most 50 words. Plain JSON, no comments.
${o.music === "cancion"
    ? `- "music" is a prompt in English for an original SONG with vocals that tells this story (genre, mood, tempo, voice type, how it builds to a chorus). "lyrics": the song's lyrics in ${spoken}, original, 6 to 10 short singable lines with a chorus, following the story's emotion (never name brands or real artists).`
    : `- "music" is a music prompt in English for the soundtrack (genre, mood, tempo, instruments, how it builds), instrumental. "lyrics": "".`}
- "title" and "logline" in Spanish${isChile(o.lang) ? " from Chile" : ""}.${isChile(o.lang) ? "\n- The story happens in Chile unless the idea says otherwise: Chilean places, streets, schools, homes and faces, so a Chilean audience feels it is theirs." : ""}

JSON shape:
{"title":"","logline":"","music":"","lyrics":"","characters":[{"key":"boy","name":"","look":""}],"shots":[{"idx":0,"seconds":2.5,"shot":"","characters":["boy"],"image":"","motion":"","narration":"","dialogue":null,"es":""}]}`;
}

/** Cleans what Claude sends back: valid keys, lengths that add up, at most 24 shots. */
/** Cleans what Claude (or the browser) sends: valid unique keys, lengths that add up, at most 24 shots. */
export function tidyPlan(p0: StoryPlan | null | undefined, seconds: number, rescale = true): StoryPlan {
  const p = (p0 && typeof p0 === "object" ? p0 : {}) as Partial<StoryPlan>;
  const base = (k: unknown) => String(k ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_-]/g, "").slice(0, 20);
  // raw key → clean unique key ("niño" → "nino"; two that clash get a number)
  const map = new Map<string, string>();
  const used = new Set<string>();
  const characters = (Array.isArray(p.characters) ? p.characters : [])
    .filter((c) => c && c.key && c.look)
    .slice(0, 4)
    .map((c) => {
      let k = base(c.key) || "c";
      for (let n = 2; used.has(k); n++) k = `${(base(c.key) || "c").slice(0, 18)}${n}`;
      used.add(k);
      map.set(String(c.key), k);
      map.set(base(c.key), map.get(base(c.key)) ?? k);
      return { key: k, name: String(c.name || c.key).slice(0, 40), look: String(c.look).slice(0, 600), image_url: null, voiceId: typeof c.voiceId === "string" && /^[A-Za-z0-9]{10,40}$/.test(c.voiceId) ? c.voiceId : null };
    });
  const keyOf = (k: unknown) => map.get(String(k ?? "")) ?? map.get(base(k)) ?? null;
  let shots = (Array.isArray(p.shots) ? p.shots : []).filter((s) => s && s.image).slice(0, 24).map((s, i) => {
    const speaker = s.dialogue ? keyOf(s.dialogue.speaker) : null;
    const line = s.dialogue ? shortLine(String(s.dialogue.line ?? "")) : "";
    const secs = Number(s.seconds);
    return {
      idx: i,
      seconds: Math.min(rescale ? 5 : 8, Math.max(1.5, Number.isFinite(secs) ? secs : 2.5)),
      shot: String(s.shot ?? "").slice(0, 80),
      characters: [...new Set((Array.isArray(s.characters) ? s.characters : []).map(keyOf).filter((k): k is string => Boolean(k)))].slice(0, 3),
      image: String(s.image).slice(0, 1200),
      motion: String(s.motion ?? "").slice(0, 500),
      narration: String(s.narration ?? "").slice(0, 300),
      dialogue: speaker && line ? { speaker, line } : null,
      es: String(s.es ?? "").slice(0, 200),
    };
  });
  // a new story: scale the lengths so the film lasts what the customer asked for
  const total = shots.reduce((a, s) => a + s.seconds, 0);
  if (rescale && total > 0) {
    const k = seconds / total;
    shots = shots.map((s) => ({ ...s, seconds: Math.round(Math.min(5, Math.max(1.5, s.seconds * k)) * 10) / 10 }));
  }
  // a spoken line needs its time (up to 8 s; the film gets a bit longer rather than cutting words)
  shots = shots.map((s) => (s.dialogue ? { ...s, seconds: Math.min(8, Math.max(s.seconds, lineSeconds(s.dialogue.line))) } : s));
  return { title: String(p.title ?? "Historia").slice(0, 80), logline: String(p.logline ?? "").slice(0, 300), music: String(p.music ?? "").slice(0, 600), lyrics: String(p.lyrics ?? "").slice(0, 1200), characters, shots };
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

export function motionPrompt(shot: StoryShot, style: StyleId, plan?: StoryPlan, lang: StoryLang = "es-CL", ambient = false) {
  const st = styleById(style);
  const base = `${shot.motion || "Subtle natural movement, slow cinematic camera push-in."} Keep the style (${st.name}: ${st.prompt}) and the characters exactly as in the first frame. Smooth, cinematic motion. No text or captions.`;
  if (shot.dialogue && speaks(shot)) {
    const who = plan?.characters.find((c) => c.key === shot.dialogue!.speaker);
    const name = who ? `${who.name} (${who.look.split(/[.,]/)[0]})` : shot.dialogue.speaker;
    return `${base}
${name} looks natural and speaks this line out loud, with clear lip sync and a voice that fits their age and gender, in ${langById(lang).spoken}: "${shot.dialogue.line}"
Only ${who?.name ?? "this character"} speaks; everyone else stays silent. No background music, no other voices.`.slice(0, 2400);
  }
  return `${base} No dialogue, no lip movement.${ambient ? " Natural ambient sound of the scene only (no music, no voices)." : ""}`.slice(0, 2400);
}

/** Rough provider cost of a whole film, to show before starting. */
export function estimateStory(o: { characters: number; shots: number; videoSecondsPerShot: number; usdPerSecond: number; usdPerImage: number; seconds: number }) {
  const images = (o.characters + o.shots) * o.usdPerImage;
  const video = o.shots * o.videoSecondsPerShot * o.usdPerSecond;
  const music = (0.15 * Math.max(o.seconds, 15)) / 60;
  return { images: +images.toFixed(2), video: +video.toFixed(2), music: +music.toFixed(2), total: +(images + video + music).toFixed(2) };
}

/** Claude writes (or rewrites) the dialogue of an existing story, looking at the shot images in order. */
export function dialoguePrompt(o: { idea: string; plan: StoryPlan; lang: StoryLang; context: string; withImages: boolean[]; all?: boolean }) {
  const chars = o.plan.characters.map((c) => `- ${c.key}: ${c.name} — ${c.look}`).join("\n");
  const shots = o.plan.shots
    .map((s, i) => `#${i + 1} (${s.seconds}s, ${s.shot}; on screen: ${s.characters.join(", ") || "nobody"}${o.withImages[i] ? `; image ${o.withImages.slice(0, i + 1).filter(Boolean).length}` : ""}): ${s.es} — ${s.image}${s.dialogue?.line ? ` [current line: ${s.dialogue.speaker}: "${s.dialogue.line}"]` : ""}`)
    .join("\n");
  return `You are the screenwriter of a short animated film for social media. Write the DIALOGUE for the shots below.
The attached images are the first frames of the shots, in order (each shot says which image is its frame). Look at them: who is on screen, where they are, their expressions. Lines must fit what we SEE.

Original idea from the customer:
"""
${o.idea.slice(0, 3000)}
"""
${o.context.trim() ? `Extra context and instructions from the customer (follow them):\n"""\n${o.context.slice(0, 2000)}\n"""\n` : ""}
Characters (keys):
${chars}

Shots:
${shots}

Rules:
- Language: ${langById(o.lang).spoken}.
${o.all ? "- This is a full movie with dialogue: EVERY shot where a character is on screen gets a line, so the conversation flows from shot to shot like a film scene. Only shots with nobody on screen stay silent (null)." : "- Give dialogue to the key moments only (about a third to a half of the shots). Silent shots let the music and images breathe."}
- One speaker per shot, and only a character that is ON SCREEN in that shot, ideally facing camera. At most 12 words per line.
- Lines must feel real and emotional (a short film, not an ad): the scolding, the encounter, the lesson, the first win, the return. Build an arc; the last line should land.
- Keep any current line that already works; improve the rest.

JSON: {"shots":[{"idx":0,"dialogue":{"speaker":"key","line":"..."}},{"idx":1,"dialogue":null}]} with every shot index.`;
}

/** Writes (or rewrites) the lyrics of a story's song. */
export function lyricsPrompt(o: { idea: string; plan: StoryPlan; lang: StoryLang; context?: string }) {
  const secs = Math.round(o.plan.shots.reduce((a, s) => a + s.seconds, 0));
  return `Write the lyrics of an original song for this short animated film. Language: ${langById(o.lang).spoken}.
Story: ${o.plan.title}: ${o.plan.logline}
Idea: ${o.idea.slice(0, 1500)}
${o.context?.trim() ? `Customer's notes: ${o.context.slice(0, 800)}\n` : ""}The film lasts about ${secs} seconds: 6 to 10 short singable lines with a chorus, following the story's emotion. Original; never name brands or real artists.
Also write a music prompt in English for the song (genre, mood, tempo, voice type).
JSON: {"lyrics":"line 1\\nline 2","music":"..."}`;
}

/** The whole story as a readable script (to copy, share or paste anywhere). */
export function storyScript(plan: StoryPlan, st: { narrator?: boolean; music_mode?: MusicMode }) {
  const name = (k: string) => plan.characters.find((c) => c.key === k)?.name ?? k;
  let t = 0;
  const rows = plan.shots.map((s, i) => {
    const from = t;
    t += s.seconds;
    const say = [s.dialogue?.line ? `${name(s.dialogue.speaker)}: «${s.dialogue.line}»` : "", st.narrator && s.narration?.trim() ? `Narrador: «${s.narration.trim()}»` : ""].filter(Boolean).join(" · ");
    return `${i + 1}. [${from.toFixed(1)}–${t.toFixed(1)} s] ${s.es}${say ? `\n   ${say}` : ""}`;
  });
  const mode = st.music_mode ?? "ia";
  return [
    plan.title.toUpperCase(), plan.logline, "",
    "PERSONAJES", ...plan.characters.map((c) => `- ${c.name}`), "",
    "GUION", ...rows, "",
    mode === "ninguna" ? "MÚSICA: sin música." : mode === "propia" ? "MÚSICA: la canción que subiste." : `MÚSICA: ${plan.music}`,
    ...(mode === "cancion" && plan.lyrics?.trim() ? ["", "LETRA", plan.lyrics.trim()] : []),
  ].join("\n");
}
