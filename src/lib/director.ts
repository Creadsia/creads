import { type FormatId, formatById } from "./formats";

// The scene director, ported from the prototype (FORMAT_LOCK, FMT_DIR, fmtDirectorPrompt, the UGC director
// prompt and genPrompt0). Step 1: Claude directs every cut (where, framing, action). Step 2: each cut gets
// a self-contained prompt for the video model, with the spoken words locked.

export interface CutIn {
  tipo: string;
  texto: string;
  mostrar?: string;
  speaker?: string;
  persona?: string;
}

export interface Direction {
  label?: string;
  framing?: string;
  movement?: string;
  setting?: string;
  action?: string;
  broll?: string;
  emotion?: string;
  style?: string;
}

export interface SceneContext {
  format: FormatId;
  lang: "en" | "es-CL";
  aspect: "9:16" | "16:9" | "1:1" | "4:5";
  avatar?: { description: string; hasPhoto: boolean } | null;
  place?: string;
  product?: { name: string; description?: string; hasPhoto: boolean } | null;
  direction?: string; // the producer's direction, in Spanish
  rules?: string[]; // learned rules (English)
  script: string; // the whole script, for context
}

export const FORMAT_LOCK: Partial<Record<FormatId, string>> = {
  ronda: `FORMAT LOCK — HANDHELD PHONE ROLL-CALL VIDEO (real people answering a question).
- Filmed vertically on a phone by a person who walks around the place asking people questions. The person filming is NEVER seen; only their voice is heard (off-camera).
- The on-camera person talks to the person filming, standing slightly off-axis to the lens, like a casual real moment. They NEVER film themselves (they may hold up their own phone only to SHOW it).
- Each clip shows ONE ordinary real person (not a model, not an actor look) from the same place; different people across the video. When the same person appears in two clips, they look identical (same face, same clothes).
- Same location, same time of day, same lighting and same atmosphere in every clip.`,
  noticiero: `FORMAT LOCK — THIS IS A TV-STYLE FIELD NEWS REPORT. IT IS NOT A SELFIE AND NOT A UGC VIDEO.
- It is filmed by a SEPARATE professional camera operator standing about 2 meters in front of the reporter (third-person shot, camera at eye level on a shoulder rig).
- The reporter NEVER holds a phone, NEVER films himself or herself, NEVER stretches an arm toward the camera.
- In EVERY second of EVERY clip the reporter holds a black handheld news microphone (no logo, no mic flag) in one hand, close to the mouth, and talks to the camera like a correspondent on location.
- Wardrobe for this video (overrides any other clothing): a navy blazer over a light blue button-up shirt.
- On location outdoors in a residential neighborhood. Stable professional framing with slight natural handheld movement.
- NO channel logos, NO lower thirds, NO news tickers, NO graphics, NO text of any kind.`,
  entrevista: `FORMAT LOCK — STREET INTERVIEW FILMED BY A CAMERA OPERATOR. IT IS NOT A SELFIE AND NOT A UGC VIDEO.
- A SEPARATE camera operator films from about 1.5 meters away (third-person, documentary handheld). Nobody holds a phone to film themselves.
- In EVERY clip the REPORTER holds a black handheld microphone (no logo) and points it toward whoever is speaking.
- Outdoors on a sidewalk of a suburban American neighborhood; the two people stand facing each other at an angle to the camera.
- Same two people, same clothes, same street in every clip. The reporter is a different person from the homeowner.`,
  podcast: `FORMAT LOCK — VIDEO PODCAST IN A STUDIO. IT IS NOT A SELFIE AND NOT A UGC VIDEO.
- Filmed by fixed studio cameras on tripods (third-person). Nobody holds a phone.
- In EVERY clip both people sit at a table, each with a professional podcast microphone on a boom arm in front of the mouth and over-ear headphones.
- Warm studio lighting, acoustic foam panels, a plant, dark background; natural video-podcast look.
- Same two people, same clothes, same studio in every clip.`,
  faceless: `FORMAT LOCK — FACELESS DOCUMENTARY B-ROLL. IT IS NOT A SELFIE AND NOT A TALKING-HEAD VIDEO.
- NOBODY talks to the camera, nobody looks into the lens, nobody holds a phone to film themselves, NO lip movement. The narration is added later as a voiceover.
- Each clip is ONE third-person documentary-style shot of exactly what the voiceover describes (places, objects, people doing things naturally).`,
  antes: `FORMAT LOCK — BEFORE / AFTER DOCUMENTARY B-ROLL. IT IS NOT A SELFIE AND NOT A TALKING-HEAD VIDEO.
- NOBODY talks to the camera, nobody holds a phone to film themselves, NO lip movement. The narration is added later as a voiceover.
- Each clip is ONE third-person shot: the problem (before), the work in progress, or the finished result (after) in the same space.`,
};

const FORMAT_REMIND: Partial<Record<FormatId, string>> = {
  ronda: "REMINDER: handheld phone footage by an unseen person asking questions; the on-camera person answers them casually; same place and lighting as the other clips; not a selfie.",
  noticiero: "REMINDER: third-person field report filmed by a camera operator; the reporter holds a handheld microphone in EVERY frame; NOT a selfie, no phone in hand.",
  entrevista: "REMINDER: third-person street interview filmed by a camera operator; the reporter's handheld microphone is visible in EVERY clip; NOT a selfie, no phone in hand.",
  podcast: "REMINDER: studio video podcast with boom-arm microphones and headphones in EVERY clip; NOT a selfie.",
  faceless: "REMINDER: no talking head, no selfie, nobody speaks on camera.",
  antes: "REMINDER: no talking head, no selfie, nobody speaks on camera.",
};

const FMT_DIR: Partial<Record<FormatId, string>> = {
  ronda: `This is a ROLL-CALL video: someone walks around one place with a phone and asks different people a quick question (the asker is OFF-CAMERA, only heard). Each cut has ONE different on-camera person (see ON-CAMERA PERSON in each cut) with whatever makes them part of that place (their car, their truck, their tools…). Keep the SAME place, time of day and lighting in every cut. Handheld phone framing, medium or medium close-up, the person turned a little toward the asker, natural background activity. Vary each person's pose and spot inside the place.`,
  faceless: `This is a FACELESS video: a voiceover narrates the script (it is added later). On screen there is NO presenter talking to the camera and NO lip-sync. For EACH cut, design ONE realistic shot that shows exactly what the voiceover is saying at that moment (e.g. a close-up of a stair-step crack in a brick foundation; a contractor measuring a wall; a worried homeowner reading a quote at the kitchen table seen from the side, not talking; a hand holding a phone checking a website with the screen not readable; a family relaxed in their repaired home). Vary shot types across cuts (macro close-up, slow push-in, handheld walk-through, over-the-shoulder, wide establishing). It must feel like real phone or documentary footage, not a stock commercial. People may appear but never speak to the camera.`,
  antes: `This is a BEFORE / AFTER video with a voiceover (added later); nobody talks to the camera. The first cuts show the problem in its worst believable state (dated bathroom, cracked foundation, water damage), the middle cuts show the work being done (crew, tools, progress), and the final cuts show the finished result in the SAME space and, when possible, the same angle, so the transformation is obvious. One clear shot per cut, synced to what the voiceover says at that moment.`,
  entrevista: `This is a STREET INTERVIEW like the ones on TikTok/Instagram: a friendly reporter holding a handheld microphone (no logo) stops a homeowner on a sidewalk of a suburban neighborhood. Most cuts have ONE speaker (SPEAKER). A DIALOGUE cut has both people talking in turn: use a two-shot where both are clearly visible, each one speaking only their own lines. When the REPORTER speaks: the reporter is seen from behind or at the edge of frame holding the mic, the homeowner listening. When the HOMEOWNER speaks: medium close-up of the homeowner answering into the mic, slightly handheld, natural reactions. Same street, same two people, same clothes in every cut; small natural camera moves; when the homeowner mentions something visible (a crack, a crew truck) you may pan to it briefly.`,
  podcast: `This is a PODCAST CLIP: two people in a cozy home podcast studio with professional microphones on boom arms, warm practical lights, acoustic panels and a plant. Most cuts have ONE speaker (SPEAKER). A DIALOGUE cut has both people talking in turn: use a two-shot where both are clearly visible, each one speaking only their own lines. Frame the speaker in a medium close-up talking into the mic; the other person can be partially visible listening and reacting. Alternate angles like a real multi-camera podcast (single close-up, wide two-shot, over-the-shoulder). Same set, same people, same clothes in every cut. The video opens mid-conversation (cold open), no intro. In the final call-to-action cut the HOST turns and looks straight into the camera while saying it.`,
  noticiero: `This is a FIELD REPORT: a reporter talks straight to a camera held by a camera operator, outside in a residential neighborhood in front of houses, holding a generic handheld microphone with NO logo. It feels like on-the-street local reporting but with NO channel names, NO logos, NO on-screen graphics, NO tickers. Vary between medium shot, walk-and-talk, and quick cutaways to what the reporter mentions (a cracked foundation, a crew truck) while the reporter keeps talking.`,
};

const CLOTHES = /\b(shirt|t-shirt|tee|sweater|jacket|hoodie|blazer|cardigan|blouse|dress|coat|vest|top|jeans|suit|scarf)\b/i;
const PLACES = /\b(room|kitchen|bedroom|living|dining|bookshel\w*|office|background|home|house|porch|yard|garden|couch|sofa|desk|studio|car|street|outside|indoors|outdoors|photos?)\b/i;
const parts = (d: string) => String(d || "").split(/,|;/).map((x) => x.trim()).filter(Boolean);
const noClothes = (d: string) => parts(d).filter((x) => !CLOTHES.test(x)).join(", ");
const personOnly = (d: string) => parts(d).filter((x) => !PLACES.test(x)).join(", ");

const speakerName: Record<string, string> = { reporter: "REPORTER", homeowner: "HOMEOWNER", host: "HOST", guest: "GUEST", voice: "VOICE", person: "PERSON" };

/** Who says what inside a cut: dialogue cuts split into lines (questions go to the asker). */
export function cutLines(c: CutIn, format: FormatId): { speaker: string; text: string }[] {
  const txt = c.texto.trim();
  if (c.speaker !== "dialogo") return [{ speaker: c.speaker || "", text: txt }];
  const ask = format === "entrevista" ? "reporter" : format === "ronda" ? "voice" : "host";
  const ans = format === "entrevista" ? "homeowner" : format === "ronda" ? "person" : "guest";
  const sent = (txt.match(/[^.!?]+[.!?]+["”']?|[^.!?]+$/g) || [txt]).map((x) => x.trim()).filter(Boolean);
  const out: { speaker: string; text: string }[] = [];
  for (const s of sent) {
    const who = /\?["”']?$/.test(s) ? ask : ans;
    const last = out[out.length - 1];
    if (last && last.speaker === who) last.text += " " + s;
    else out.push({ speaker: who, text: s });
  }
  return out;
}

function cast(ctx: SceneContext, avatar: string) {
  const f = formatById(ctx.format);
  if (f.narr) return "No on-camera presenter (voiceover only).";
  if (ctx.format === "entrevista") return `HOMEOWNER (interviewee, same person in every cut): ${avatar || "a friendly homeowner in their late 40s, casual clothes"}. REPORTER: a young friendly street reporter, casual smart clothes.`;
  if (ctx.format === "podcast") return `GUEST (same person in every cut): ${avatar || "a homeowner in their 40s, casual clothes"}. HOST: a relaxed podcast host in their 30s, hoodie.`;
  if (ctx.format === "ronda") return "A DIFFERENT ordinary person in each cut (described per cut as ON-CAMERA PERSON). The person filming is off-camera and only heard.";
  if (ctx.format === "noticiero") return `REPORTER (same person in every cut): ${avatar || "a professional reporter in their 30s, smart casual jacket"}.`;
  return `Presenter: ${avatar}`;
}

/** Step 1: the prompt that asks Claude to direct every cut. */
export function directorPrompt(ctx: SceneContext, cuts: CutIn[]): string {
  const f = formatById(ctx.format);
  const avatar = ctx.avatar?.description?.trim() || (f.av === "req" ? "a friendly American homeowner in their 40s, casual clothes" : "");
  const dir = (ctx.direction ?? "").trim().slice(0, 1200);
  const list = cuts
    .map((c, i) => {
      const n = i + 1;
      const dur = Math.max(2, Math.round(c.texto.split(/\s+/).length / 2.7));
      const says = f.narr
        ? `VOICEOVER SAYS: "${c.texto}"`
        : c.speaker === "dialogo"
          ? `DIALOGUE (both people talk, in this order): ${cutLines(c, ctx.format).map((l) => `${l.speaker.toUpperCase()}: "${l.text}"`).join(" / ")}`
          : c.speaker
            ? `SPEAKER: ${c.speaker.toUpperCase()} | SAYS: "${c.texto}"`
            : `SAYS: "${c.texto}"`;
      return `CUT ${n} [${c.tipo}] ~${dur}s | ${says}${c.persona ? ` | ON-CAMERA PERSON: ${c.persona}` : ""} | suggested visual: ${c.mostrar || "-"}`;
    })
    .join("\n");
  const shape = `Reply ONLY JSON array: [{"label":"1","framing":"shot type (different from the previous cut)","movement":"camera and subject movement","setting":"exact location","action":"what happens, synced to specific words: 'On \\"...\\" ...'","broll":"optional cutaway or empty","emotion":"tone","style":""}]`;
  const producer = dir ? `THE PRODUCER'S DIRECTION FOR THE WHOLE VIDEO (written in Spanish — follow it in every cut where it applies; top priority after the locked words): "${dir}"` : "";
  const product = ctx.product ? `PRODUCT the presenter shows in the video: ${ctx.product.description || ctx.product.name}. Show it clearly whenever the words talk about it.` : "";
  const chile = ctx.lang === "es-CL" ? "The video is in Chilean Spanish and happens in Chile: Chilean homes, streets and details." : "";

  if (ctx.format !== "ugc" && ctx.format !== "comentario") {
    return `You are directing a realistic lead-gen video ad made with AI in the format "${f.en}". It must look real and believable, not like a polished commercial.
${FORMAT_LOCK[ctx.format] ?? ""}
EVERY cut you direct must obey the FORMAT LOCK above, and the "framing" and "action" of EVERY cut must explicitly describe it (who holds the camera, the microphone or studio setup, what is visible) — never only in the first cut. ${ctx.format === "ronda" ? "Never describe a selfie or an on-camera person filming themselves (an on-camera person may hold up a phone to SHOW it, with the screen not readable). Keep the SAME place, time of day and lighting in every cut, and repeat the exact ON-CAMERA PERSON description given for that cut." : "Never describe a selfie, a phone in hand or someone filming themselves."}
${cast(ctx, personOnly(avatar))}
${ctx.place ? `Where it starts: ${ctx.place}` : ""}
${producer}
${product}
${chile}
Full script for context:
"""
${ctx.script.slice(0, 6000)}
"""
Cuts (the words are LOCKED and must not change):
${list}
${FMT_DIR[ctx.format] ?? ""}
THE WORDS ARE SACRED: what we see must illustrate exactly what is being said in that cut and nothing else. No readable text, numbers, prices, logos or brand names anywhere on screen. Physically simple actions the AI video model can render (one clear action per cut).${dir ? ' In each cut put in "style" a short English instruction with the part of the producer\'s direction that applies (or empty).' : ""}
${shape}`;
  }

  return `You are directing a realistic UGC-style lead-gen video ad made with AI. It must look like a REAL person filmed it on their phone, not an ad.
Presenter (same person, same face, same clothes, same voice in every cut): ${avatar}
Where the video starts: ${ctx.place || "(you decide)"}
${producer}
${product}
${chile}
Full script for context:
"""
${ctx.script.slice(0, 6000)}
"""
Cuts (the spoken words are LOCKED and must not change):
${list}
Read the whole script first and understand the story. Then, for EACH cut, decide WHERE the person is and WHAT happens, based on what is being said in that cut, so the video tells the story like a real person documenting it on their phone. Do NOT keep every cut in the same place: move through the locations the story implies. A cut may stay in the same place as the previous one when the story has not moved.
ALWAYS selfie UGC: the person holds the phone and talks to the front camera. To show something (a crack, the contractors, the quote, a screen), they point at it behind them, angle the phone, or briefly flip to the rear camera while the voice keeps going. Never a cinematic third-person shot, never a professional camera.
MAKE IT DYNAMIC, like a real person excitedly documenting a discovery they want to share: every cut needs a DIFFERENT shot from the previous one. Rotate framings (tight face close-up · chest-up talking · walking selfie with the background moving · low angle with the phone held down · over-the-shoulder flip to the rear camera · holding a paper or phone screen up to the lens · leaning in toward the camera for the key line). Add real movement in most cuts. Never two consecutive cuts with the same framing AND the same place. When the words reveal something (a price, the site, the problem, the result), SHOW it on camera at that exact moment.
THE WORDS ARE SACRED: the action must illustrate exactly what is being said in that cut and nothing else. Do not invent extra dialogue, do not add a greeting or a closing line, and do not stage something that contradicts the words.${dir ? ' Apply the producer\'s direction above to every cut where it fits, and in each cut put in "style" a short English instruction with the part of that direction that applies to that cut (or empty).' : ""} Same person, wardrobe and voice in every cut. Refer to the presenter with the right pronoun for the described person. Keep it believable: real home, real phone, no actors posing. No readable text, prices or logos on screen.
${shape}`;
}

/** Step 2: the self-contained prompt for one cut (prototype: genPrompt + genPrompt0). */
export function scenePrompt(ctx: SceneContext, c: CutIn, d: Direction, index: number): string {
  const f = formatById(ctx.format);
  const desc = ctx.avatar?.description?.trim() || (f.av === "req" ? "a friendly American homeowner in their 40s, casual clothes" : "");
  const ref = ctx.avatar?.hasPhoto ? "the person in the reference image (use it only for the face / identity; ignore its framing, clothes and background)" : "";
  const orient = ctx.aspect === "1:1" ? "Square 1:1" : ctx.aspect === "16:9" ? "Horizontal 16:9" : ctx.aspect === "4:5" ? "Vertical 4:5" : "Vertical 9:16";
  const tail = `Realism: real footage, natural light, real textures, no beauty filter, mild compression, believable, not a glossy commercial.
No music. No subtitles, no captions, no on-screen text, no readable numbers, no logos, no watermark.`;
  let p: string;

  if (f.narr) {
    p = `${FORMAT_LOCK[ctx.format]}

${orient} realistic video for a ${f.en} ad. NOBODY speaks on camera: no presenter, no lip-sync, nobody talks to the camera (a voiceover is added later). Ambient sound only.
VOICEOVER for this clip (for context only, NOT spoken on screen): "${c.texto}"
Setting: ${d.setting || ctx.place || "a real suburban American home"}.
Shot: ${d.framing || "handheld, natural"}.${d.movement ? `\nMovement: ${d.movement}.` : ""}
What we see, synced to the voiceover: ${d.action || c.mostrar || "a clear shot that illustrates the line"}.${d.broll ? `\nCutaway: ${d.broll}` : ""}${d.style ? `\nProducer's direction for this clip: ${d.style}` : ""}
${tail}
${FORMAT_REMIND[ctx.format] ?? ""}`;
  } else if (ctx.format === "ronda") {
    const ls = cutLines({ ...c }, "ronda");
    const where = ctx.place || d.setting || "the same place as the other clips";
    const night = /night|noche|evening|dark|neon/i.test(`${where} ${d.setting ?? ""}`);
    const lines = ls.map((l) => (l.speaker === "voice" ? `OFF-CAMERA VOICE (the unseen person filming): "${l.text}"` : `ON-CAMERA PERSON: "${l.text}"`)).join("\n");
    p = `${FORMAT_LOCK.ronda}

DIALOGUE (exactly as written, every word, in this order, nothing added or removed):
${lines}
${ls.some((l) => l.speaker === "voice") ? "LIP-SYNC RULE: the OFF-CAMERA VOICE comes from behind the phone and is never seen. While the off-camera voice talks, the on-camera person's lips stay CLOSED (they just listen and react). The on-camera person's lips move ONLY on their own lines." : "Only the on-camera person speaks; nobody else talks."}
OFF-CAMERA VOICE (identical in every clip of this ad): a man in his late 20s, upbeat, casual and friendly, natural American accent.

${orient} realistic handheld phone video.
PLACE (the same in every clip of this ad): ${where}.${d.setting && d.setting !== where ? `\nSpot inside the place for this clip: ${d.setting}.` : ""}
ON-CAMERA PERSON (only in this clip; exactly as described, same clothes if they appear in another clip): ${c.persona || "an ordinary local person"}.
Shot: ${d.framing || "handheld phone, medium close-up, the person slightly turned toward the person filming"}.${d.movement ? `\nMovement: ${d.movement}.` : ""}
American English, natural casual voices.
Delivery: ${d.emotion || "relaxed, genuine, a little proud"}.
What happens, synced to the words: ${d.action || "the person answers naturally and gestures toward what they talk about"}.${d.style ? `\nProducer's direction for this clip: ${d.style}` : ""}
Lighting: ${night ? "night scene lit only by real sources: car headlights and taillights, parking-lot lamps, the phone's light; real night colors, slight grain" : "true to the place and time of day, natural, consistent with the other clips"}.
Sound: the voices clear and in front; quiet real ambience of the place underneath. No music.
Realism: real phone footage, real textures, ordinary-looking people, no beauty filter, mild compression, believable, not a glossy commercial.
No subtitles, no captions, no on-screen text, no readable numbers or plates, no logos or brand badges in focus, no watermark. Any phone screen shown is not readable.
Reminder: the dialogue is ONLY: ${ls.map((l) => `${l.speaker === "voice" ? "VOICE" : "PERSON"}: "${l.text}"`).join(" ")}
${FORMAT_REMIND.ronda}`;
  } else if (ctx.format === "entrevista" || ctx.format === "podcast" || ctx.format === "noticiero") {
    const spk = c.speaker || (ctx.format === "noticiero" ? "reporter" : "");
    const isAv = ["homeowner", "guest"].includes(spk) || ctx.format === "noticiero";
    const role = ({ reporter: ctx.format === "noticiero" ? "the reporter" : "the street reporter", homeowner: "the homeowner", host: "the podcast host", guest: "the podcast guest" } as Record<string, string>)[spk] || "the speaker";
    const setting = d.setting || ctx.place || (ctx.format === "podcast" ? "a cozy home podcast studio" : "a sidewalk in a suburban American neighborhood");
    const castLine = cast(ctx, ctx.format === "noticiero" ? noClothes(personOnly(desc)) : personOnly(desc)).replace(/^Presenter: /, "");
    if (spk === "dialogo") {
      const ls = cutLines(c, ctx.format);
      const face = ctx.format === "podcast" ? "The podcast guest" : "The homeowner";
      p = `${FORMAT_LOCK[ctx.format]}

DIALOGUE (both people talk in this clip, taking turns, exactly as written, every word, in this order, nothing added or removed; each person says ONLY their own lines):
${ls.map((l) => `${speakerName[l.speaker] ?? l.speaker.toUpperCase()}: "${l.text}"`).join("\n")}

${orient} realistic ${f.en} video.
${castLine}${ref ? ` ${face} has the FACE of ${ref}.` : ""}
Setting: ${setting}.
Shot: ${d.framing || "two-shot, both people clearly visible"}.${d.movement ? `\nMovement: ${d.movement}.` : ""}
American English, natural conversational voices, two clearly different voices; lips move only for the person speaking.
Delivery: ${d.emotion || "natural, engaged"}.
What happens, synced to the words: ${d.action || "they look at each other and react naturally while the other talks"}.${d.style ? `\nProducer's direction for this clip: ${d.style}` : ""}
${tail} Same people, same clothes, same voices as the other clips.
Reminder: the dialogue is ONLY: ${ls.map((l) => `${speakerName[l.speaker] ?? l.speaker.toUpperCase()}: "${l.text}"`).join(" ")}
${FORMAT_REMIND[ctx.format] ?? ""}`;
    } else {
      p = `${FORMAT_LOCK[ctx.format]}

SPOKEN LINE (said ONLY by ${role}, exactly as written, every word, in this order, nothing added or removed): "${c.texto}"
${ctx.format === "noticiero" ? "Nobody else speaks." : "The other person does NOT speak in this clip."}

${orient} realistic ${f.en} video.${ctx.aspect === "1:1" ? " Keep the speaker centered for a square frame." : ""}
${castLine}${isAv && ref ? ` ${role[0].toUpperCase() + role.slice(1)} has the FACE of ${ref}.` : ""}
Setting: ${setting}.
Shot: ${d.framing || "medium close-up of the speaker"}.${d.movement ? `\nMovement: ${d.movement}.` : ""}
American English, natural conversational voice.
Delivery: ${d.emotion || "natural, engaged"}.
What happens, synced to the words: ${d.action || "natural gestures while talking"}.${d.broll ? `\nCutaway: ${d.broll}` : ""}${d.style ? `\nProducer's direction for this clip: ${d.style}` : ""}
${tail} Same people, same clothes, same voices as the other clips.
Reminder: ${role} says ONLY: "${c.texto}"
${FORMAT_REMIND[ctx.format] ?? ""}`;
    }
  } else {
    // UGC selfie and reply-to-comment
    const who = ref ? `${ref} — ${desc}` : desc;
    p = `SPOKEN LINE (the ONLY words in this video, said exactly as written, every word, in this order, nothing added, nothing removed, no greeting, no extra ending): "${c.texto}"

${orient} UGC selfie video, filmed by a real person on an iPhone, handheld.${ctx.aspect === "1:1" ? " Keep the face and the important action centered so it works in a square frame." : ""} The person is ${who}.${ctx.format === "comentario" && index === 0 ? " IMPORTANT FRAMING: keep the top 30% of the frame free of the face (hold the phone a bit higher so the head sits in the middle of the frame) because a comment sticker will be placed at the top during the first seconds." : ""}
Setting: ${d.setting || ctx.place || "their own home, natural daylight"}.
Shot: ${d.framing || "handheld selfie, chest-up"}.${d.movement ? `\nMovement: ${d.movement}.` : ""}
American English, natural conversational voice.
Delivery: ${d.emotion || "calm, sincere, like telling a friend"}.
What happens, synced to the words: ${d.action || "natural small gestures while talking."}${d.broll ? `\nWhile still talking, the person ${d.broll}` : ""}${d.style ? `\nProducer's direction for this clip: ${d.style}` : ""}
Realism: real phone footage, slight handheld shake, natural light, real skin texture, no beauty filter, not cinematic, mild compression. Same person, same clothes, same voice as the other clips.
No music. No subtitles, no captions, no on-screen text, no logos, no watermark.
Reminder: the person says ONLY: "${c.texto}"`;
  }

  // Product, language and learned rules go before the closing reminder (prototype: genPrompt).
  const extra: string[] = [];
  if (ctx.product) {
    extra.push(
      `PRODUCT${ctx.product.hasPhoto ? " (must look EXACTLY like the product reference image: same design, colors, shape and proportions; never redesign, simplify or swap it)" : ""}: ${ctx.product.description || ctx.product.name}. When this line talks about the product, the person holds it up or points to it so it is clearly visible to the camera; otherwise it stays visible next to them in the scene. Only ONE of this product, never duplicated, never distorted, no extra text on it.`,
    );
  }
  if (ctx.rules?.length) extra.push(`LESSONS FROM PAST VIDEOS (avoid these mistakes):\n- ${ctx.rules.slice(0, 10).join("\n- ")}`);
  if (extra.length) {
    const i = p.search(/\n(Reminder:|REMINDER:)/);
    p = i > 0 ? `${p.slice(0, i)}\n${extra.join("\n")}${p.slice(i)}` : `${p}\n${extra.join("\n")}`;
  }
  if (ctx.lang === "es-CL") {
    p = p.replace(/American English/g, "Chilean Spanish (español de Chile, natural Chilean accent and intonation)") +
      "\nLANGUAGE: the person speaks Chilean Spanish (español de Chile) with a natural Chilean accent, exactly the words written above. The place looks like Chile (Chilean homes and streets).";
  }
  return p;
}

/** A still first frame for models that animate an image (Kling, Seedance): same scene, no motion. */
export function firstFramePrompt(ctx: SceneContext, c: CutIn, d: Direction): string {
  const f = formatById(ctx.format);
  const orient = ctx.aspect === "1:1" ? "square 1:1" : ctx.aspect === "16:9" ? "horizontal 16:9" : ctx.aspect === "4:5" ? "vertical 4:5" : "vertical 9:16";
  const who = f.narr
    ? "No presenter: a documentary shot of the scene."
    : ctx.format === "ronda"
      ? `On-camera person: ${c.persona || "an ordinary local person"}.`
      : `${ctx.avatar?.hasPhoto ? "The person from the first reference image (same face). " : ""}${ctx.avatar?.description || "a friendly American homeowner in their 40s"}.`;
  return `Photorealistic ${orient} still frame, the first frame of a ${f.en} video clip, looks like a real phone video frame (not a staged photo).
${who}
Setting: ${d.setting || ctx.place || "a real home, natural daylight"}.
Shot: ${d.framing || "handheld, chest-up"}.
Moment: the instant before they start talking: ${d.action ? d.action.replace(/On "[^"]*"/g, "").slice(0, 300) : "a natural relaxed expression, mouth closed"}.
${FORMAT_LOCK[ctx.format] ? FORMAT_LOCK[ctx.format]!.split("\n").slice(0, 3).join(" ") : "Selfie framing: the phone is the camera, held at arm's length."}
${ctx.product ? `The product is visible in the scene${ctx.product.hasPhoto ? ", exactly like the product reference image" : ""}: ${ctx.product.description || ctx.product.name}.` : ""}
${ctx.lang === "es-CL" ? "The place looks like Chile." : ""}
Natural light, real skin texture, no beauty filter, no text, no captions, no logos, no watermark.`;
}
