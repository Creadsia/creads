// The "Crear" tools: one-step jobs on a photo, video or audio (remove a background, upscale, edit,
// make a photo talk, lip-sync, dub). This file is safe for the browser: names, inputs, limits and
// price estimates. The calls to fal.ai / ElevenLabs live in src/lib/providers/tools.ts (server only).

export type ToolId =
  | "quitar-fondo"
  | "editar-imagen"
  | "mejorar-imagen"
  | "mejorar-video"
  | "editar-video"
  | "copiar-movimiento"
  | "avatar-habla"
  | "sincronizar-labios"
  | "doblaje"
  | "musica"
  | "efectos";

export interface ToolDef {
  id: ToolId;
  name: string;
  /** One line for the menu card. */
  short: string;
  /** What it does and what to give it, for the tool page. */
  lead: string;
  output: "image" | "video" | "audio";
  /** The model doing the work, shown to the customer. */
  model: string;
  inputs: {
    image?: boolean; // one photo
    images?: number; // several photos (max)
    imagesOptional?: boolean; // the photos are optional references
    video?: { min: number; max: number }; // seconds
    audio?: { min: number; max: number }; // seconds; can also be written and read by a voice
    prompt?: "required" | "optional";
    promptHint?: string;
    target?: boolean; // dubbing: language to dub into
    length?: number[]; // the customer picks how long the result is (seconds)
    instrumental?: boolean; // music: offer "sin voz"
  };
  /** US$ estimate. `seconds` is the length of the video or audio the customer gave. */
  estimate: (seconds: number) => number;
  priceNote: string;
  /** True when the provider doesn't publish an exact price (we show "aprox."). */
  approx?: boolean;
  /** Needs the person's permission (faces and voices). */
  consent?: boolean;
  /** Ready-made instructions the customer can tap to start from. */
  ideas?: string[];
}

const ceil5 = (s: number) => Math.max(5, Math.ceil(s / 5) * 5);

export const TOOLS: ToolDef[] = [
  {
    id: "quitar-fondo",
    name: "Quitar fondo",
    short: "Recorta la persona o el producto en un segundo.",
    lead: "Sube una foto y te devolvemos el recorte con fondo transparente (PNG), listo para poner sobre cualquier fondo.",
    output: "image",
    model: "Bria RMBG",
    inputs: { image: true, prompt: "optional", promptHint: "Opcional: qué conservar, por ejemplo «solo la botella» o «la persona con el perro»." },
    estimate: () => 0.03,
    priceNote: "US$0,02–0,03 por imagen",
  },
  {
    id: "editar-imagen",
    name: "Editar imagen",
    short: "Cambia lo que quieras de una foto, escribiéndolo.",
    lead: "Sube una o varias fotos y escribe el cambio: «ponle una polera azul», «cambia el fondo por una cocina», «pon este producto en su mano».",
    output: "image",
    model: "Nano Banana Pro",
    inputs: { images: 4, prompt: "required", promptHint: "Describe el cambio. Si subes varias fotos, di qué tomar de cada una." },
    estimate: () => 0.15,
    priceNote: "US$0,15 por imagen",
  },
  {
    id: "mejorar-imagen",
    name: "Mejorar calidad (imagen)",
    short: "Sube la resolución al doble sin perder detalle.",
    lead: "Para fotos chicas o borrosas: la devolvemos al doble de tamaño, más nítida.",
    output: "image",
    model: "SeedVR2",
    inputs: { image: true },
    estimate: () => 0.02,
    priceNote: "≈ US$0,01–0,02 por imagen",
    approx: true,
  },
  {
    id: "mejorar-video",
    name: "Mejorar calidad (video)",
    short: "Lleva un clip a 1080p, más nítido.",
    lead: "Sube un clip de hasta 30 segundos y lo devolvemos en 1080p, con más detalle.",
    output: "video",
    model: "SeedVR2",
    inputs: { video: { min: 1, max: 30 } },
    // US$0.001 per megapixel-frame: 1080×1920 × 30 fps ≈ US$0.062 per second.
    estimate: (s) => +(0.062 * Math.max(1, s)).toFixed(2),
    priceNote: "≈ US$0,06 por segundo",
  },
  {
    id: "editar-video",
    name: "Editar video",
    short: "Cambia la cara, el lugar o lo que quieras de un video, escribiéndolo.",
    lead: "Sube un video de 3 a 10 segundos (por ejemplo un UGC) y escribe el cambio: «cambia el fondo por una cocina moderna», «ponle una polera roja», «reemplaza a la persona por la de la foto 1», «que tenga en la mano el producto de la foto 2». Se mantienen el movimiento y el audio originales.",
    output: "video",
    model: "Kling O1 Edit",
    inputs: {
      video: { min: 3, max: 10 },
      images: 4,
      imagesOptional: true,
      prompt: "required",
      promptHint: "Describe el cambio. Si subes fotos, nómbralas: «foto 1», «foto 2». Ej: «cambia la cara de la mujer por la de la foto 1 y el lugar por una playa al atardecer».",
    },
    estimate: (s) => +(0.168 * Math.max(3, Math.ceil(s))).toFixed(2),
    priceNote: "≈ US$0,17 por segundo de video",
    approx: true,
    consent: true,
    ideas: [
      "Cambia a la persona por la de la foto 1, con la misma ropa y los mismos gestos.",
      "Cambia el producto que tiene en la mano por el de la foto 1.",
      "Cambia el lugar por una cocina moderna y luminosa.",
      "Cambia el fondo por un living cálido de casa chilena.",
      "Ponle una polera del color de mi marca y deja todo lo demás igual.",
    ],
  },
  {
    id: "copiar-movimiento",
    name: "Copiar movimiento",
    short: "Tu personaje hace exactamente los mismos movimientos de otro video.",
    lead: "Sube un video que te guste (de 3 a 30 segundos) y la foto de tu personaje: tu personaje repite los mismos gestos, poses y movimientos de cámara. Ideal para recrear un anuncio ganador con tu propia cara o avatar.",
    output: "video",
    model: "Kling 3.0 Motion Control",
    inputs: {
      image: true,
      video: { min: 3, max: 30 },
      prompt: "optional",
      promptHint: "Opcional: el lugar o detalles, por ejemplo «en una cocina moderna, luz de día». Si no escribes nada, se mantiene el estilo de la foto.",
    },
    // billed per second of the result, which is as long as the video given
    estimate: (s) => +(0.126 * Math.max(3, Math.ceil(s))).toFixed(2),
    priceNote: "≈ US$0,13 por segundo de video",
    consent: true,
    ideas: [
      "En una cocina moderna y luminosa, luz natural.",
      "En un living cálido, cámara en mano estilo UGC.",
      "En la calle, de día, estilo video de celular.",
    ],
  },
  {
    id: "avatar-habla",
    name: "Avatar que habla",
    short: "Una foto + una voz = una persona hablando a cámara.",
    lead: "Sube la foto de una persona y su audio (o escribe el texto y elige una voz). La foto cobra vida y habla con labios sincronizados.",
    output: "video",
    model: "OmniHuman 2",
    inputs: { image: true, audio: { min: 4, max: 60 }, prompt: "optional", promptHint: "Opcional: cómo se mueve, por ejemplo «gesticula con las manos, sonríe al final»." },
    estimate: (s) => +(0.16 * Math.max(4, s)).toFixed(2),
    priceNote: "≈ US$0,16 por segundo de audio",
    approx: true,
    consent: true,
  },
  {
    id: "sincronizar-labios",
    name: "Sincronizar labios",
    short: "Cambia lo que dice una persona en un video.",
    lead: "Sube un video de 2 a 10 segundos y el audio nuevo (o escríbelo y elige una voz). La boca se mueve con las palabras nuevas.",
    output: "video",
    model: "Kling Lipsync",
    inputs: { video: { min: 2, max: 10 }, audio: { min: 2, max: 60 } },
    estimate: (s) => +(0.014 * ceil5(s)).toFixed(2),
    priceNote: "US$0,014 por segundo de video",
    consent: true,
  },
  {
    id: "doblaje",
    name: "Doblaje EN ⇄ ES",
    short: "Tu video en otro idioma, con la misma voz.",
    lead: "Sube un video o audio de hasta 5 minutos y elige el idioma. Lo traducimos y lo doblamos con la voz original.",
    output: "video",
    model: "ElevenLabs Dubbing",
    inputs: { video: { min: 2, max: 300 }, target: true },
    estimate: (s) => +((0.5 * Math.max(s, 10)) / 60).toFixed(2),
    priceNote: "US$0,50 por minuto (tu plan incluye 12 min al mes)",
    consent: true,
  },
  {
    id: "musica",
    name: "Música IA",
    short: "Una canción o fondo musical a medida, libre de derechos.",
    lead: "Describe el estilo, el ánimo y los instrumentos. Ideal como música de fondo para tus anuncios y reels.",
    output: "audio",
    model: "ElevenLabs Music",
    inputs: { prompt: "required", promptHint: "Por ejemplo: «pop latino alegre, guitarra y percusión, 100 bpm, para un anuncio de verano».", length: [15, 30, 60], instrumental: true },
    estimate: (s) => +((0.15 * Math.max(s, 15)) / 60).toFixed(2),
    priceNote: "US$0,15 por minuto",
  },
  {
    id: "efectos",
    name: "Efectos de sonido",
    short: "Whoosh, clics, aplausos, ambiente: lo que describas.",
    lead: "Describe el sonido y su largo. Sirve para transiciones, ganchos y ambiente de tus videos.",
    output: "audio",
    model: "ElevenLabs Sound Effects",
    inputs: { prompt: "required", promptHint: "Por ejemplo: «whoosh rápido de transición» o «ambiente de cafetería con gente conversando».", length: [2, 5, 10, 20, 30] },
    estimate: (s) => +((0.12 * Math.max(s, 2)) / 60).toFixed(2),
    priceNote: "US$0,12 por minuto",
  },
];

export const findTool = (id: string) => TOOLS.find((t) => t.id === id);

export const DUB_LANGS = [
  { id: "es", label: "Español" },
  { id: "en", label: "Inglés" },
  { id: "pt", label: "Portugués" },
] as const;
