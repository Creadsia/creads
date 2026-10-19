// The examples shown in Explorar and in each workspace. One list for the whole studio: add an entry
// here and it appears in every gallery that shows its kind. Only material made by Creads for its own
// site (nothing from other platforms). Picking an example never generates or spends credits: it only
// fills the workspace (model, format, length and, when there is one, a starting idea).
// TODO: move to a table with an owner screen to add examples without a deploy.

export type ExKind = "anuncio" | "video" | "imagen" | "recrear" | "audio" | "influencer";
export type ExAspect = "9:16" | "4:5" | "1:1" | "16:9";

export interface Example {
  id: string;
  kind: ExKind;
  title: string;
  /** What kind of piece it is (filter chips). */
  tag: string;
  /** Provider id of the model that made it (fills the workspace), when known. */
  model?: string;
  modelLabel: string;
  aspect: ExAspect;
  seconds?: number;
  video?: string;
  still?: string;
  /** A starting idea written by Creads (not necessarily the exact prompt the example used). */
  idea?: string;
  /** Where to make one like it, for kinds without their own workspace. */
  href?: string;
}

const CLIP = "https://d2ol7oe51mr4n9.cloudfront.net/user_3DdKYHg29Dc6YLtguhB32IBiQZ7/";
const IMG = "https://d8j0ntlcm91z4.cloudfront.net/user_3DdKYHg29Dc6YLtguhB32IBiQZ7/hf_20261015_220556_";
const H = (stamp: string, id: string) => `https://d8j0ntlcm91z4.cloudfront.net/user_3DdKYHg29Dc6YLtguhB32IBiQZ7/hf_${stamp}_${id}.mp4`;
const clip = (v: string, s?: string) => ({ video: `${CLIP}${v}.mp4`, ...(s ? { still: `${CLIP}${s}.jpg` } : {}) });
const scene = (id: string) => `${IMG}${id}.png`;

const S = {
  ugc: scene("0c908a12-e315-4bc9-b0b9-f2e30ce41a32"),
  podcast: scene("6dd2acd7-4699-4665-b27b-a4f1cdc87267"),
  serum: scene("648442ce-d231-4608-9ee3-6e421dc462e7"),
  valpo: scene("638f557e-139c-4ebe-a0dc-b91d0f5adb64"),
  coach: scene("454a7b5b-f21a-4097-8205-2bfafe2e9489"),
  chef: scene("db507db9-6f46-4813-a3a9-076767d0545d"),
  realtor: scene("829d052f-a160-420e-86e4-ac469d9f5b65"),
  car: scene("8a59f674-4577-4a57-a01e-c6c0f60290b2"),
  sneaker: scene("3975c800-9d1b-4133-aefd-c01a2a1e1cd6"),
  news: scene("4201ea1f-ac6c-48db-9c04-d0d4385b6468"),
};

export const EXAMPLES: Example[] = [
  // ---------- complete ads ----------
  { id: "ad-coach", kind: "anuncio", title: "UGC a cámara", tag: "UGC", modelLabel: "Anuncio completo", aspect: "9:16", video: `${CLIP}1d1b7dbe-d2c5-4930-a843-2dbe2834c080.mp4`, still: S.coach, href: "/app/crear", idea: "Una persona habla a cámara desde su casa, cuenta su problema y cómo lo resolvió con el producto. Cierra con un llamado a la acción." },
  { id: "ad-podcast", kind: "anuncio", title: "Podcast", tag: "Podcast", modelLabel: "Anuncio completo", aspect: "4:5", video: `${CLIP}dbf87bbe-75ec-407e-8dfb-b8a48c570644.mp4`, still: S.podcast, href: "/app/crear", idea: "Dos personas conversan en un estudio de podcast; una pregunta y la otra explica el beneficio del producto." },
  { id: "ad-realtor", kind: "anuncio", title: "Testimonio", tag: "Testimonio", modelLabel: "Anuncio completo", aspect: "9:16", still: S.realtor, href: "/app/crear", idea: "Un cliente cuenta su experiencia con el servicio, con cortes a detalles del lugar." },
  { id: "ad-news", kind: "anuncio", title: "Noticiero", tag: "Noticiero", modelLabel: "Anuncio completo", aspect: "9:16", still: S.news, href: "/app/crear", idea: "Formato de noticiero: una presentadora anuncia la novedad y da los datos clave." },

  // ---------- video clips ----------
  { id: "v-serum", kind: "video", title: "Producto en movimiento", tag: "Producto", model: "kling-3.0-turbo", modelLabel: "Kling 3.0 Turbo", aspect: "4:5", seconds: 5, video: `${CLIP}dbfb983f-a3d8-4a46-bb53-e86fc64f91d6.mp4`, still: S.serum, idea: "Slow push-in on a glass serum bottle on a bathroom shelf, soft morning light, water droplets, premium skincare ad look" },
  { id: "v-valpo", kind: "video", title: "Influencer en la calle", tag: "Personas", model: "kling-3.0-turbo", modelLabel: "Kling 3.0 Turbo", aspect: "9:16", seconds: 5, video: `${CLIP}9b933c53-6d3c-4306-9eff-5d0bd4bd58b0.mp4`, still: S.valpo, idea: "A young woman walks up a colorful hillside street, turns to camera and smiles, handheld phone footage, natural light" },
  { id: "v-veo-1", kind: "video", title: "Clip con Veo", tag: "Clip IA", model: "veo-3.1-lite", modelLabel: "Veo 3.1 Lite", aspect: "9:16", seconds: 6, ...clip("70b577fc-0650-41cc-a267-6131307a18c0", "1d9b7270-fb34-420a-8371-9b7f65ec0bfe") },
  { id: "v-veo-2", kind: "video", title: "Clip con Veo", tag: "Clip IA", model: "veo-3.1-lite", modelLabel: "Veo 3.1 Lite", aspect: "9:16", seconds: 6, ...clip("a1310874-fe73-4989-9e6f-7de4d4d96426", "b9c4463c-3d31-414a-a898-2158c8df5112") },
  { id: "v-kling-1", kind: "video", title: "Clip con Kling", tag: "Clip IA", model: "kling-3.0-turbo", modelLabel: "Kling 3.0 Turbo", aspect: "9:16", seconds: 5, ...clip("d4597de4-41e3-4d88-b199-a252d7d47bb3", "c88c6477-6b88-4339-8e55-d5fc9ad02ce3") },
  { id: "v-kling-2", kind: "video", title: "Clip con Kling", tag: "Clip IA", model: "kling-3.0-turbo", modelLabel: "Kling 3.0 Turbo", aspect: "9:16", seconds: 5, ...clip("bff9a5a4-3a41-4ecc-bea3-4326067b05b0", "0d8d1a1b-7db6-4f0b-9fb3-5a3e9ca85651") },
  { id: "v-seed25", kind: "video", title: "Clip con Seedance", tag: "Clip IA", model: "seedance-2.5", modelLabel: "Seedance 2.5", aspect: "9:16", seconds: 5, ...clip("59617700-cf90-497f-8a75-4ed74416c22f", "94ba857c-b593-487c-8d18-819c0141addb") },
  { id: "v-seed20", kind: "video", title: "Clip con Seedance", tag: "Clip IA", model: "seedance-2.0", modelLabel: "Seedance 2.0", aspect: "9:16", seconds: 5, ...clip("4017cd54-61b4-43e9-97bc-5271ff328c79", "4f285d47-5240-4a5c-a485-3d0bfc2c9c55") },
  { id: "v-cat", kind: "video", title: "Personaje que habla", tag: "Habla", model: "seedance-2.5", modelLabel: "Seedance 2.5", aspect: "9:16", seconds: 8, video: H("20261017_141030", "6bd5aa9a-673e-49cf-be26-7ce48bd86404") },
  { id: "v-viking", kind: "video", title: "Personaje que habla", tag: "Habla", model: "seedance-2.5", modelLabel: "Seedance 2.5", aspect: "9:16", seconds: 8, video: H("20261017_141029", "66e7e42e-add7-44cc-a3a2-fe3198ef8972") },
  { id: "v-wan", kind: "video", title: "Clip con Wan", tag: "Clip IA", model: "wan-3.0", modelLabel: "Wan 3.0", aspect: "9:16", seconds: 5, ...clip("3d5e741d-9422-4221-95ca-38349129b40e", "afff3cf2-a9d2-4b30-9e60-5b5f70596a08") },
  { id: "v-grok-1", kind: "video", title: "Clip con Grok", tag: "Clip IA", model: "grok-video-1.5", modelLabel: "Grok Imagine Video", aspect: "9:16", seconds: 5, ...clip("81fb90d2-22c5-404f-92d8-a201275530cf", "9a50f2c6-6bbd-4891-8299-f1151a77c433") },
  { id: "v-grok-2", kind: "video", title: "Clip con Grok", tag: "Clip IA", model: "grok-video-1.5", modelLabel: "Grok Imagine Video", aspect: "9:16", seconds: 5, ...clip("9c9fb74d-c0af-46f9-9d43-211d4783ef90", "d82cb55a-cbb2-41dd-8bc7-209000b0a58d") },
  { id: "v-hailuo", kind: "video", title: "Clip con Hailuo", tag: "Clip IA", model: "hailuo-2.3", modelLabel: "Hailuo 2.3", aspect: "9:16", seconds: 6, ...clip("61bc428a-05e4-4443-afe7-7dd2976c69f5", "b8044d86-a0a2-4a5d-a52a-35814a3df137") },

  // ---------- images ----------
  { id: "i-serum", kind: "imagen", title: "Foto de producto", tag: "Producto", modelLabel: "Imagen IA", aspect: "4:5", still: S.serum, idea: "Product photo of a glass serum bottle on a marble bathroom shelf, soft morning light, water droplets, premium skincare ad, 4:5" },
  { id: "i-sneaker", kind: "imagen", title: "Producto para feed", tag: "Producto", modelLabel: "Imagen IA", aspect: "4:5", still: S.sneaker, idea: "A white sneaker floating over a clean colored background, studio lighting, sharp detail, e-commerce ad for Instagram feed" },
  { id: "i-chef", kind: "imagen", title: "Lifestyle en la cocina", tag: "Lifestyle", modelLabel: "Imagen IA", aspect: "4:5", still: S.chef, idea: "A home cook plating a dish in a warm kitchen, natural window light, candid lifestyle photo" },
  { id: "i-ugc", kind: "imagen", title: "Selfie estilo UGC", tag: "Personas", modelLabel: "Imagen IA", aspect: "9:16", still: S.ugc, idea: "Selfie of a woman in her 30s in her living room holding a product, natural light, realistic phone photo, UGC style" },
  { id: "i-coach", kind: "imagen", title: "Experto a cámara", tag: "Personas", modelLabel: "Imagen IA", aspect: "9:16", still: S.coach, idea: "A fitness coach in a bright gym looking at the camera, realistic phone photo, vertical" },
  { id: "i-car", kind: "imagen", title: "Escena con auto", tag: "Escenas", modelLabel: "Imagen IA", aspect: "9:16", still: S.car, idea: "A person leaning on a car at golden hour on a city street, cinematic, vertical" },
  { id: "i-realtor", kind: "imagen", title: "Corredora de propiedades", tag: "Personas", modelLabel: "Imagen IA", aspect: "9:16", still: S.realtor, idea: "A real estate agent in front of a modern house, smiling, holding keys, natural light, vertical" },
  { id: "i-news", kind: "imagen", title: "Set de noticiero", tag: "Escenas", modelLabel: "Imagen IA", aspect: "9:16", still: S.news, idea: "A news anchor at a modern TV news desk, studio lights, screens in the background, vertical" },

  // ---------- recreate ----------
  { id: "r-persona", kind: "recrear", title: "Cambia la persona", tag: "Persona", modelLabel: "Kling", aspect: "9:16", video: H("20261017_140835", "0bb466fd-c5ff-4411-a99a-563d461bc55a"), href: "/app/recrear" },
  { id: "r-producto", kind: "recrear", title: "Cambia el producto", tag: "Producto", modelLabel: "Kling", aspect: "9:16", video: H("20261017_140830", "0e730dd0-cefb-4d70-ac18-8d72e9af733a"), href: "/app/recrear" },
  { id: "r-lugar", kind: "recrear", title: "Cambia el lugar", tag: "Lugar", modelLabel: "Seedance 2.5", aspect: "9:16", video: H("20261017_140830", "93c8c63c-dd8d-4d69-ac0b-7aaa79c2a30b"), href: "/app/recrear" },
  { id: "r-capibara", kind: "recrear", title: "Copia el movimiento", tag: "Movimiento", modelLabel: "Kling Motion Control", aspect: "9:16", video: H("20261017_140830", "92ce32cc-512b-4a02-a8e5-58c6fd1abe8e"), href: "/app/recrear" },
  { id: "r-caballero", kind: "recrear", title: "Copia el movimiento", tag: "Movimiento", modelLabel: "Kling Motion Control", aspect: "9:16", video: H("20261017_140830", "482997fb-e07a-4882-9377-8bb5d37d09b2"), href: "/app/recrear" },

  // ---------- audio ----------
  { id: "a-doblaje-es", kind: "audio", title: "Doblaje al español", tag: "Doblaje", modelLabel: "ElevenLabs", aspect: "9:16", video: H("20261017_140356", "c56fb9ce-9eed-44db-98c3-fe789cc411db"), href: "/app/herramientas/doblaje" },
  { id: "a-doblaje-en", kind: "audio", title: "Doblaje al inglés", tag: "Doblaje", modelLabel: "ElevenLabs", aspect: "9:16", video: H("20261017_141028", "d08ddd05-eb7b-4a4d-a895-1b04640595a8"), href: "/app/herramientas/doblaje" },

  // ---------- AI influencer ----------
  { id: "inf-valpo", kind: "influencer", title: "Tu personaje", tag: "Personaje", modelLabel: "Influencer IA", aspect: "9:16", video: `${CLIP}9b933c53-6d3c-4306-9eff-5d0bd4bd58b0.mp4`, still: S.valpo, href: "/app/influencer" },
];

export const KIND_LABEL: Record<ExKind, string> = {
  anuncio: "Anuncios",
  video: "Video",
  imagen: "Imagen",
  recrear: "Recrear video",
  audio: "Audio",
  influencer: "Influencer IA",
};

/** Where "Crear algo similar" takes the visitor: the studio, already filled in (login first if needed). */
export function exampleHref(e: Example) {
  if (e.kind === "video" || e.kind === "imagen") return labHref({ prompt: e.idea, model: e.model, aspect: e.aspect, seconds: e.seconds });
  return e.href ?? "/app";
}

/** The studio's «Video e imagen IA» page with the settings filled in (it reads these on load; nothing runs). */
export function labHref(o: { prompt?: string; model?: string; aspect?: string; seconds?: number }) {
  const q = new URLSearchParams();
  if (o.prompt) q.set("p", o.prompt.slice(0, 1500));
  if (o.model) q.set("m", o.model);
  if (o.aspect) q.set("a", o.aspect);
  if (o.seconds) q.set("s", String(o.seconds));
  const qs = q.toString();
  return `/app/laboratorio${qs ? `?${qs}` : ""}`;
}

export const findExample = (id: string | null | undefined) => EXAMPLES.find((e) => e.id === id);
export const examplesOf = (kind: ExKind) => EXAMPLES.filter((e) => e.kind === kind);

/** A small, cached thumbnail of a still (through the site's image optimizer). */
export const thumb = (src: string, w = 384) => `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=65`;
