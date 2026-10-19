import type { ExKind } from "@/lib/examples";

// The site's category pages (creadsia.com/ia/…): one per item of the top menu. Spanish only for now
// (the launch is in Chile); /en keeps its one-page menu.

export interface Categoria {
  slug: string;
  menu: string;
  title: string;
  lead: string;
  /** What you get, in short lines. */
  points: string[];
  /** Where the work happens in the studio. */
  app: string;
  cta: string;
  /** Which examples to show: a kind, or a list of example ids. */
  examples?: ExKind | string[];
  /** A creation panel (video and image have one). */
  panel?: "video" | "imagen";
  /** The «De espiar a lanzar» steps under the examples. */
  flow?: boolean;
  /** Mock screens instead of media (spy and scripts). */
  mock?: "espiar" | "guiones";
  seo: string;
}

export const CATEGORIAS: Categoria[] = [
  {
    slug: "anuncios", menu: "Anuncios",
    title: "Anuncios terminados con IA, listos para subir",
    lead: "Pega un guion o parte de un anuncio que ya vende. Creads arma los cortes, la voz, los subtítulos y revisa cada corte antes de entregarte el anuncio.",
    points: ["UGC a cámara, podcast, testimonio, noticiero y más formatos", "Revisión de calidad en cada corte antes de armar", "9:16 para Reels y TikTok, 4:5 para el feed", "En español de Chile o en inglés"],
    app: "/app/crear", cta: "Crear mi anuncio", examples: "anuncio", flow: true,
    seo: "Crea anuncios en video con IA: UGC, podcast y testimonios con voz, subtítulos y revisión de calidad. Listos para Meta y TikTok.",
  },
  {
    slug: "espiar", menu: "Espiar",
    title: "Espía los anuncios que ya están vendiendo",
    lead: "Busca por nicho o marca en la Biblioteca de anuncios de Meta. Si un anuncio lleva semanas activo, alguien está ganando plata con él: ese es tu punto de partida.",
    points: ["Busca por palabra y país", "Ordenados por días activos: los de 30 días o más están vendiendo", "Llévalo a guion con un clic"],
    app: "/app/spy", cta: "Empezar a espiar", mock: "espiar", flow: true,
    seo: "Espía los anuncios ganadores de tu nicho en la Biblioteca de anuncios de Meta y conviértelos en tu propio anuncio con IA.",
  },
  {
    slug: "guiones", menu: "Guiones y hooks",
    title: "Desarma un guion ganador y escribe el tuyo",
    lead: "Pega un anuncio que funciona: Creads te dice por qué vende (el hook, el ángulo y la estructura) y escribe 3 versiones tuyas y 10 hooks nuevos para probar.",
    points: ["Hook, ángulo, dolor, oferta y llamado a la acción", "3 versiones del guion con tu producto", "10 hooks nuevos para probar", "Ajusta cualquier línea con una frase"],
    app: "/app/guiones", cta: "Desarmar un guion", mock: "guiones", flow: true,
    seo: "Analiza guiones de anuncios ganadores con IA: hook, ángulo y estructura. Escribe nuevas versiones y 10 hooks para probar.",
  },
  {
    slug: "video", menu: "Video",
    title: "Todos los modelos de video con IA, en un solo lugar",
    lead: "Veo 3.1, Kling 3.0, Seedance 2.5, Hailuo, Wan y Grok. Escribe qué quieres ver o parte desde una imagen, y ve el precio antes de generar.",
    points: ["Clips con voz: la persona dice lo que escribes entre comillas", "Desde texto o desde una imagen", "Vertical, feed, cuadrado u horizontal", "El precio en créditos antes de apretar"],
    app: "/app/laboratorio", cta: "Crear un video", examples: "video", panel: "video",
    seo: "Genera videos con IA usando Veo 3.1, Kling 3.0, Seedance 2.5, Hailuo, Wan y Grok desde un solo estudio, en español.",
  },
  {
    slug: "imagen", menu: "Imagen",
    title: "Imágenes con IA para tus anuncios",
    lead: "Fotos de producto, personas y escenas para el feed. Suma una foto de tu producto o de una cara y la imagen la mantiene.",
    points: ["Nano Banana, Seedream y FLUX", "Mantén tu producto o una cara con una foto de referencia", "4:5 para el feed y 9:16 para historias", "Úsala como primer cuadro de un video"],
    app: "/app/laboratorio", cta: "Crear una imagen", examples: "imagen", panel: "imagen",
    seo: "Crea fotos de producto, personas y escenas con IA para tus anuncios: Nano Banana, Seedream y FLUX en español.",
  },
  {
    slug: "audio", menu: "Audio",
    title: "Voces, doblaje y música con IA",
    lead: "Clona tu voz, elige una de la biblioteca, dobla un video del inglés al español o crea música y efectos para tus anuncios.",
    points: ["Clona tu voz con una muestra corta", "Doblaje inglés ⇄ español con la misma voz", "Música y efectos para tus anuncios", "Voces en español y en inglés"],
    app: "/app/voces", cta: "Probar las voces", examples: ["a-doblaje-es", "a-doblaje-en", "ad-podcast", "v-cat", "v-viking"],
    seo: "Clona tu voz, dobla videos del inglés al español y crea música con IA para tus anuncios.",
  },
  {
    slug: "recrear", menu: "Recrear video",
    title: "Recrea cualquier video que ya funciona",
    lead: "Sube un video y cambia la persona, el producto o el lugar, o copia su movimiento con otro personaje. El resto queda igual.",
    points: ["Cambia la persona por tu avatar", "Cambia el producto por el tuyo", "Cambia el lugar", "Copia el movimiento con otro personaje"],
    app: "/app/recrear", cta: "Recrear un video", examples: "recrear",
    seo: "Recrea videos con IA: cambia la persona, el producto o el lugar, o copia el movimiento con tu propio personaje.",
  },
  {
    slug: "influencer", menu: "Influencer IA",
    title: "Tu propio influencer con IA",
    lead: "Crea un personaje original que sale con la misma cara en todos tus videos, con su personalidad y su voz. Sin contratar a nadie.",
    points: ["Su ficha: frente, perfil, espalda y cara", "La misma cara en cada video", "Su personalidad y su voz", "Videos con su cara desde un guion"],
    app: "/app/influencer", cta: "Crear mi personaje", examples: ["inf-valpo", "v-cat", "v-viking", "r-persona", "i-ugc"],
    seo: "Crea tu influencer con IA: un personaje original con la misma cara y voz en todos tus videos.",
  },
];

export const findCategoria = (slug: string) => CATEGORIAS.find((c) => c.slug === slug);
